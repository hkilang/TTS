import gc
import json
from io import BytesIO

import torch
import soundfile as sf

from commons import intersperse
from symbols import pad, waitau_symbols, hakka_symbols, waitau_symbol_to_id, hakka_symbol_to_id
from utils import load_model

class ToneError(Exception): pass
class SymbolError(Exception): pass

def application(environ, start_response):
    code, content = app(environ.get("PATH_INFO"))
    if code == 200:
        type = "audio/mpeg"
    else:
        type = "application/json"
        content = json.dumps(content).encode()
    start_response(str(code), [("Content-Type", type), ("Content-Length", str(len(content)))])
    yield content

def app(path):
    try:
        function, language, text = path.encode("latin_1").decode().lower().strip("/").split("/")
        if function != "tts" or language not in {"waitau", "hakka"}: raise ValueError("Invalid URI segment")
    except UnicodeError as err:
        codec, content, start, end, reason = err.args
        content = content[start:end]
        if isinstance(content, bytes): content = content.decode("latin_1")
        return (500, {"error": "Error while decoding URI: invalid characters", "message": content})
    except ValueError:
        return (404, {"error": "Page not found"})
    try:
        buffer = BytesIO()
        sf.write(buffer, generate_audio(language, text.replace("+", " ")), 44100, format="MP3")
        return (200, buffer.getvalue())
    except ToneError as err:
        return (500, {"error": "Invalid syllable", "message": str(err)})
    except SymbolError as err:
        return (500, {"error": "Unrecognized symbol", "message": str(err.__cause__)})
    except Exception as err:
        return (500, {"error": "Unexpected error", "message": type(err).__name__ + ": " + str(err)})

waitau = None
hakka = None
device = "cpu"

def generate_audio(language, text):
    global waitau, hakka
    if language == "waitau":
        if waitau is None: waitau = load_model("data/waitau.pth", "data/config.json", len(waitau_symbols))
    else:
        if hakka is None: hakka = load_model("data/hakka.pth", "data/config.json", len(hakka_symbols))

    phones, tones, word2ph = [pad], [0], [1]
    for syllable in text.split():
        if len(syllable) == 1:
            phones.append(syllable)
            tones.append(0)
            word2ph.append(1)
            continue
        try:
            tone = int(syllable[-1], base=7)
        except ValueError as err:
            raise ToneError(f"'{syllable}' does not end with tone 0~6") from err
        it = (i for i, c in enumerate(syllable) if c in "aeiouäöüæ")
        index = next(it, 0)
        initial = syllable[:index] or syllable[index]
        if language == "waitau":
            final = syllable[index:-1]
            phones += [initial, final]
            tones += [tone, tone]
            word2ph.append(2)
        else:
            medial = "i" if initial == "j" else "#"
            final_index = index
            if syllable[index] == "i":
                final_index = next(it, index)
                if final_index != index:
                    medial = "i"
            final = syllable[final_index:-1]
            phones += [initial, medial, final]
            tones += [tone, 0 if medial == "#" else tone, tone]
            word2ph.append(3)

    phones.append(pad)
    tones.append(0)
    word2ph.append(1)
    symbol_to_id = waitau_symbol_to_id if language == "waitau" else hakka_symbol_to_id
    try:
        phones = [symbol_to_id[symbol] for symbol in phones]
    except KeyError as err:
        raise SymbolError() from err
    lang_ids = [0] * len(phones)

    phones = intersperse(phones, 0)
    tones = intersperse(tones, 0)
    lang_ids = intersperse(lang_ids, 0)
    word2ph = [n * 2 for n in word2ph]
    word2ph[0] += 1
    del word2ph

    phones = torch.LongTensor(phones)
    tones = torch.LongTensor(tones)
    lang_ids = torch.LongTensor(lang_ids)
    with torch.no_grad():
        x_tst = phones.to(device).unsqueeze(0)
        tones = tones.to(device).unsqueeze(0)
        lang_ids = lang_ids.to(device).unsqueeze(0)
        x_tst_lengths = torch.LongTensor([phones.size(0)]).to(device)
        del phones
        speakers = torch.LongTensor([0]).to(device)
        audio = (
            (waitau if language == "waitau" else hakka).infer(
                x_tst,
                x_tst_lengths,
                speakers,
                tones,
                lang_ids,
                sdp_ratio=0.5,
                noise_scale=0.6,
                noise_scale_w=0.9,
                length_scale=1.0,
            )[0][0, 0]
            .data.cpu()
            .float()
            .numpy()
        )
        del (
            x_tst,
            tones,
            lang_ids,
            x_tst_lengths,
            speakers,
        )
        gc.collect()
    return audio
