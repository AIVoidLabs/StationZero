#!/usr/bin/env python3
"""Render text to a mono 16-bit WAV with libespeak-ng (no CLI needed).

usage: espeak_render.py OUT.wav "text" VOICE [RATE] [PITCH]
"""
import ctypes
import struct
import sys
import wave

AUDIO_OUTPUT_SYNCHRONOUS = 2
POS_CHARACTER = 1
ESPEAK_CHARS_UTF8 = 1
ESPEAK_RATE = 1
ESPEAK_PITCH = 3

lib = ctypes.CDLL("libespeak-ng.so.1")
CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)

samples = bytearray()


def on_samples(wav, count, events):
    if wav and count > 0:
        samples.extend(ctypes.string_at(wav, count * 2))
    return 0


callback = CALLBACK(on_samples)

out_path, text, voice = sys.argv[1], sys.argv[2], sys.argv[3]
rate = int(sys.argv[4]) if len(sys.argv) > 4 else 150
pitch = int(sys.argv[5]) if len(sys.argv) > 5 else 50

sample_rate = lib.espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, None, 0)
if sample_rate <= 0:
    sys.exit("espeak_Initialize failed")
lib.espeak_SetSynthCallback(callback)
if lib.espeak_SetVoiceByName(voice.encode()) != 0:
    sys.exit(f"voice not found: {voice}")
lib.espeak_SetParameter(ESPEAK_RATE, rate, 0)
lib.espeak_SetParameter(ESPEAK_PITCH, pitch, 0)
data = text.encode("utf-8")
lib.espeak_Synth(data, len(data) + 1, 0, POS_CHARACTER, 0, ESPEAK_CHARS_UTF8, None, None)
lib.espeak_Synchronize()
lib.espeak_Terminate()

with wave.open(out_path, "wb") as handle:
    handle.setnchannels(1)
    handle.setsampwidth(2)
    handle.setframerate(sample_rate)
    handle.writeframes(bytes(samples))
print(f"{len(samples) // 2 / sample_rate:.2f}s @ {sample_rate} Hz")
