import gc
from http.server import BaseHTTPRequestHandler
from io import BytesIO
from urllib.parse import unquote_plus

import torch
import soundfile as sf

from commons import intersperse
from text.symbols import pad, waitau_symbol_to_id, hakka_symbol_to_id
from utils import load_model

waitau = None
hakka = None
device = "cpu"

def application(environ, start_response):
    language, text = environ.get("PATH_INFO").strip("/").split("/")
    buffer = BytesIO()
    sf.write(buffer, generate_audio(language, unquote_plus(text)), 44100, format="WAV", subtype="PCM_16")
    value = buffer.getvalue()
    status = "200 OK"
    response_headers = [("Content-Type", "audio/wav"), ("Content-Length", len(value))]
    start_response(status, response_headers)
    yield value

def generate_audio(language, text):
    global waitau, hakka
    if language == "waitau":
        if waitau is None: waitau = load_model("data/waitau.pth", "data/config.json")
    else:
        if hakka is None: hakka = load_model("data/hakka.pth", "data/config.json")

    phones, tones, word2ph = [pad], [0], [1]
    for syllable in text.split():
        if len(syllable) == 1:
            phones.append(syllable)
            tones.append(0)
            word2ph.append(1)
            continue
        tone = int(syllable[-1])
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
    phones = [(waitau_symbol_to_id if language == "waitau" else hakka_symbol_to_id)[symbol] for symbol in phones]
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
