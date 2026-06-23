# Third-party attribution — Kronos model

The model architecture code in this directory:

- `model/kronos.py`
- `model/module.py`

is derived from the **Kronos** time-series foundation model by **NeoQuasar**.

- Model hub: https://huggingface.co/NeoQuasar (Kronos-base / Kronos-small / Kronos-mini, Kronos-Tokenizer-*)
- The pretrained weights are **not** redistributed here — they are downloaded at
  runtime from the Hugging Face Hub via `from_pretrained`.

This code is included for integration purposes and remains under its original
upstream license. All credit for the Kronos model belongs to its authors.

Files written for this project (`app.py`, `Dockerfile`, `requirements.txt`) are
covered by the repository's main LICENSE.
