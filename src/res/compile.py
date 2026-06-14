import pandas as pd
import re
from functools import reduce
from pathlib import Path

RES_DIRECTORY = Path(__file__).parent.resolve()
RAW_DIRECTORY = RES_DIRECTORY / "raw"

LANGUAGES = ["waitau", "hakka"]

def str_columns(columns):
	return {"names": columns, "dtype": {key: "str" for key in columns}}

df_chars: pd.DataFrame = pd.read_csv(RAW_DIRECTORY / "dictionary.csv", header=0, usecols=[0, 1, 2, 3, 4], **str_columns(["char", "canton", "waitau", "hakka", "notes"]))

def normalize_char(char):
	if isinstance(char, str):
		char = char.strip()
		char = re.sub("\\s*(【\\s*)+.*?(】\\s*)+", "", char)
		if char:
			return char
	return pd.NA

def normalize_pron(pron):
	if isinstance(pron, str):
		pron = " ".join(re.findall("[a-zäöüæ]+[1-6]", pron))
		if pron:
			return pron
	return pd.NA

def normalize_notes(row):
	note = row["notes"]
	if isinstance(note, str):
		note = note.strip()
		note = note.replace("~", "～")
		note = note.replace(row["char"], "～")
		note = note.replace("=", "＝")
		note = re.sub("\\s*([,，]\\s*)+", "、", note)
		note = re.sub("\\s*([(（]\\s*)+", "（", note)
		note = re.sub("\\s*([)）]\\s*)+", "）", note)
		if note:
			return note
	return pd.NA

df_chars["char"] = df_chars["char"].apply(normalize_char)
df_chars[["canton", "waitau", "hakka"]] = df_chars[["canton", "waitau", "hakka"]].applymap(normalize_pron)
df_chars["notes"] = df_chars.apply(normalize_notes, axis=1)
df_chars.drop_duplicates(inplace=True)

ROM_MAPPING = {
	"a": "ä",
	"ää": "a",
	"oe": "ö",
	"eo": "ö",
	"yu": "ü",
	"j": "y",
}

def rom_map(jyutping):
	return re.sub("(g|k)u(?!ng|k)", "\\1wu", reduce(lambda pron, rule: pron.replace(*rule), ROM_MAPPING.items(), jyutping))

df_canto: pd.DataFrame = pd.read_csv(RAW_DIRECTORY / "supplementary_lexicon.csv", header=0, usecols=[0, 1], **str_columns(["char", "pron"]), na_filter=False)
df_canto["pron"] = df_canto["pron"].apply(rom_map)
df_canto["order"] = df_canto.index
df_canto_charpron = df_canto.set_index(["char", "pron"])
df_canto_charpron.sort_index(inplace=True)

def get_order(row):
	try:
		return df_canto_charpron.loc[(row["char"], row["canton"]), "order"]
	except KeyError:
		return pd.NA

df_chars["order"] = df_chars.apply(get_order, axis=1)

df_words_by_language = {}

df_words: pd.DataFrame = pd.read_csv(RAW_DIRECTORY / "lexical_items.csv", header=0, usecols=[1, 2, 3], **str_columns(["language", "char", "pron"]))
df_words["char"] = df_words["char"].str.replace("，", "")

invalid_char = df_words["char"].apply(normalize_char) != df_words["char"]
if invalid_char.any():
	print("Invalid glyphs from lexical_items.csv:")
	print(df_words[invalid_char])
	exit(1)

invalid_pron = df_words["pron"].apply(normalize_pron) != df_words["pron"]
if invalid_pron.any():
	print("Invalid romanizations from lexical_items.csv:")
	print(df_words[invalid_pron])
	exit(1)

invalid_length = df_words["char"].str.len() - df_words["pron"].str.count(" ") != 1
if invalid_length.any():
	print("Mismatched lengths of glyphs and romanizations from lexical_items.csv:")
	print(df_words[invalid_length])
	exit(1)

df_words.drop_duplicates(inplace=True)

for language in LANGUAGES:
	df_words_curr_language = df_words.loc[df_words["language"] == language, ["char", "pron"]]
	df_words_by_language[language] = df_words_curr_language

	df_monosyllabic_words = df_words_curr_language[df_words_curr_language["char"].str.len() == 1]
	df_chars_native_prons = set(df_chars.set_index(["char", language]).index)
	other_chars = []

	for charpron in zip(df_monosyllabic_words["char"], df_monosyllabic_words["pron"]):
		if charpron not in df_chars_native_prons and charpron not in other_chars:
			other_chars.append(charpron)

	char_col, pron_col = zip(*other_chars)
	df_chars = pd.concat([df_chars, pd.DataFrame({"char": char_col, language: pron_col})])

df_chars.sort_values(["char", "order", "canton"], kind="stable", inplace=True)
df_chars[["char", "waitau", "hakka", "notes"]].to_csv(RES_DIRECTORY / "chars.csv", index=False)

df_charpron = df_chars.set_index(["char", "canton"])
df_charpron.sort_index(inplace=True)

def get_collocations(row):
	note = row["notes"]
	if isinstance(note, str):
		note = note.replace("～", row["char"])
		note = re.sub("（.*?）", "", note)
		if note:
			return [collocation for collocation in note.split("、") if row["char"] in collocation]
	return []

df_chars["collocation"] = df_chars.apply(get_collocations, axis=1)
df_collocations = df_chars.explode("collocation")
df_collocations.dropna(subset="collocation", inplace=True)
df_collocations.set_index(["collocation", "char"], inplace=True)
df_collocations.sort_index(inplace=True)
df_chars.set_index("char", inplace=True)
df_chars.sort_index(inplace=True)

for language in LANGUAGES:
	other_words = []

	def get_prons(df, index):
		try:
			pron = df.loc[index, language]
		except KeyError:
			return []
		if isinstance(pron, str):
			return [pron]
		elif isinstance(pron, pd.Series):
			return [value for value in pron.unique() if not pd.isna(value)]
		else:
			return []

	def append_prons(df, index):
		roms = get_prons(df, index)
		if len(roms) == 1:
			prons.append(roms[0].strip())
			return True
		return False

	for collocation, df_collocation_chars in df_collocations.groupby(level=0):
		if any(len(get_prons(df_chars, char)) > 1 for char in collocation):
			prons = []
			if all(append_prons(df_collocation_chars, (collocation, char))
					or append_prons(df_chars, char) for char in collocation) \
					and len(prons) == len(collocation):
				other_words.append((collocation, " ".join(prons)))

	for row in df_canto.itertuples(index=False):
		chars = row.char
		roms = row.pron.split()
		if len(chars) > 1 and any(len(get_prons(df_chars, char)) > 1 for char in chars):
			prons = []
			if all(append_prons(df_charpron, charpron) for charpron in zip(chars, roms)) \
					and len(prons) == len(chars):
				other_words.append((chars, " ".join(prons)))

	df_words = df_words_by_language[language]
	char_col, pron_col = zip(*other_words)
	df_words = pd.concat([df_words[df_words["char"].str.len() > 1], pd.DataFrame({"char": char_col, "pron": pron_col})])
	df_words.drop_duplicates(inplace=True)
	df_words.to_csv(RES_DIRECTORY / f"{language}_words.csv", index=False)
