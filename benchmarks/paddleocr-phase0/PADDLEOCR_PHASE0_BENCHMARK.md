# PaddleOCR Phase 0 — Standalone Benchmark Report

Date: 2026-11-20. Isolated experiment in `benchmarks/paddleocr-phase0/`.
No OpporCheck application source, dependency, Firebase config, or Firestore
rule was modified; no OCR endpoint was added; nothing was deployed; no
billing account was touched; no hosted inference API was used. All test
content is synthetic and invented for this benchmark — no real employment
contracts, no personal information.

## 1. Executive summary

PaddleOCR 3.7.0 works CPU-only on this machine and reads clean
Indonesian, English, Malay, Japanese, and Traditional Chinese samples with
near-perfect accuracy, including every critical numeric field tested in
those five languages. The headline surprise is that the **small model
matches the default medium model exactly** on the tested English samples
(identical CER/WER to 4 decimals) while running **~4x faster**, and the
v5 Latin stack matches v6-medium on Indonesian/Malay at ~3x the speed.
The largest model is not the best choice here.

Caveats that shape any integration plan: oneDNN execution crashes on this
CPU so plain-paddle mode (`enable_mkldnn=False`, as SignalBait uses) is
required; even then a 1600px page costs ~28 s (medium) or ~7 s (small);
Thai needs the v5 Thai stack (v6 cannot read Thai at all); Vietnamese
diacritics are weak (exploratory verdict: not ready); and PaddleX's 1 s
model-hoster healthcheck false-negatives through this network's proxy, so
first-run downloads need its documented bypass flag. No document-derived
file was written anywhere outside the benchmark's own `results/`
diagnostics.

## 2. Test environment

| Item | Value |
|---|---|
| OS | Windows 11 (10.0.26100), X64 |
| CPU | AuthenticAMD Family 25 Model 117 Stepping 2, 16 logical processors (INFERRED: 8C/16T Ryzen 7 7840-class) |
| RAM | 16.4 GB total; 2.9 GB free at start (memory-pressured session) |
| Python | 3.13.7 AMD64 (`C:\Python313\python.exe`) |
| Disk (benchmark volume D:) | 600.6 GB total, 76.4 GB free |
| GPU | NVIDIA RTX 4060 Laptop present, unused (CPU-only; `compiled_with_cuda: False`) |
| Benchmark dir | [paddleocr-phase0](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0>) (new; only `?? benchmarks/` in git status) |
| SignalBait installed | paddleocr 3.7.0, paddlepaddle 3.3.1, paddlex 3.7.2, opencv-contrib-python 4.10.0.84 (non-headless), numpy 2.3.5, pillow 12.3.0 |

App-isolation evidence: the benchmark venv's `pip list` is unchanged
(identical package set to the pre-benchmark record); every `M` entry in
git status carries a LastWriteTime of Nov 14–19, predating this session
(Nov 20 ~17:13); `backend/requirements.txt`, `firestore.rules`,
`firebase.json`, and all app sources untouched.

## 3. Installation and dependency results

Isolated venv created from the base interpreter
(`C:\Python313\python.exe -m venv`), Python 3.13.7.

- `pip install paddlepaddle==3.3.1 paddleocr==3.7.0 paddlex==3.7.2`
  `opencv-contrib-python-headless==4.10.0.84 PyMuPDF Pillow psutil`
  completed with no errors and no version conflicts. Full freeze saved in
  [pip-freeze.txt](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\pip-freeze.txt>).
- Install footprint: **1001.7 MB, 26,959 files** (venv total).
- Verified imports: paddle 3.3.1 (`device: cpu`,
  `compiled_with_cuda: False`), paddleocr 3.7.0, cv2 4.10.0, Pillow
  13.0.0, numpy 2.3.5, PyMuPDF 2.1 (`import fitz` warns deprecated; use
  `import pymupdf`).
- 3.x API verified: `PaddleOCR(...).predict(...)` returns results whose
  `result.json["res"]` carries `rec_texts` and per-line `rec_scores`.
  No 2.x `ocr.ocr()` usage anywhere. Numpy (in-memory) input works
  identically to file-path input (13/13 same lines, 27.9 s vs 28.0 s).

Findings and gotchas:

1. `import paddle` writes to `~/.cache/paddle` at import time. Under a
   locked-down profile this raises `PermissionError`; all benchmark
   scripts redirect HOME/caches into the benchmark dir first (see
   [bench_env.py](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\bench_env.py>)).
   Any deployment must set a writable, persistent cache home.
2. Both `opencv-contrib-python` and `-headless` 4.10.0.84 end up
   installed (paddlex `ocr-core` extra pulls non-headless). Same
   duplication exists in SignalBait's venv. Harmless here, but the
   headless pin alone does not control which cv2 wins.
3. PaddleX's model-hoster healthcheck (`HEAD`, 1 s timeout, requires
   HTTP 200) reported all four hosters unreachable, yet direct probes
   with a 10 s timeout returned 200 from all four (BOS, HuggingFace,
   ModelScope, AIStudio; see
   [probe_net.py](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\probe_net.py>)).
   The documented bypass `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`
   was set; downloads then worked. The 1 s check is a false-negative
   risk on proxied networks, not an environment block.
4. `enable_mkldnn=False` is REQUIRED on this CPU: oneDNN execution
   fails with `NotImplementedError ...
   onednn_instruction.cc:118` on the first predict. This is presumably
   why SignalBait sets the flag. Plain-paddle mode is fully functional
   but likely slower than MKLDNN where MKLDNN works.
5. Harmless noise: ccache-missing warning on every start; PaddleX
   downloads show `Fetching N files` progress bars.

## 4. Model configurations tested

Default pipeline resolves (paddleocr 3.7.0 `ocr.py:_get_ocr_model_names`):
`lang=None` → PP-OCRv6_medium pair. `lang` in {ch, chinese_cht, en,
japan} ∪ all Latin codes except `pi` (includes id, ms, vi, mi) → the
same v6-medium pair (one multilingual rec model, no per-language
download). `lang="th"` (and eslav/arabic/cyrillic/devanagari codes) →
PP-OCRv5_server_det + script rec model. Small/tiny are explicit-name
only; there is no v6 Latin/Thai rec variant.

| Config | det model | rec model | lang | Cache MB | Cold init* | Warm init |
|---|---|---|---|---|---|---|
| v6medium_default | PP-OCRv6_medium_det 59.4 | PP-OCRv6_medium_rec 73.3 | none | 132.7 | 77.2 s | 5.5 s |
| v6medium_lang_id | same as default (confirmed) | same | id | 0 new | — | 1.8 s† |
| v6_th_lang | PP-OCRv5_server_det 84.3 | th_PP-OCRv5_mobile_rec 7.7 | th | 92.0 | 76.0 s | — |
| v6small | PP-OCRv6_small_det 9.6 | PP-OCRv6_small_rec 20.5 | — | 30.1 | 43.1 s | — |
| v5latin | PP-OCRv5_mobile_det 4.7 | latin_PP-OCRv5_mobile_rec 7.8 | — | 12.5 | 33.4 s | — |

\*: Cold init includes first-run model download (5–6 files per model,
~15–45 s each at ~2–5 MB/s through the proxy) plus oneDNN/paddle load.
†: Second pipeline in the same process; first init per process ≈ 5.5 s.

- Total cache for all five configs: ~267 MB at
  `<bench>/home/.paddlex/official_models/` (redirected; the default
  location is `~/.paddlex/official_models/`). Each model dir holds
  13–15 files. Models are never re-downloaded once cached.
- PP-OCRv6_tiny exists but was not tested (small already matches medium
  quality; tiny is a follow-up, not a gap).
- No Vietnamese-specific model exists; `lang="vi"` resolves to the v6
  medium pair (same as default).

## 5. Language support and accuracy

Samples: 9 synthetic PNGs (1600 px wide, 42 pt; Arial for Latin,
NotoSansJP for Japanese, msjh.ttc for Traditional Chinese, Leelawadee
for Thai) with exact ground-truth files — see
[samples/](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\samples>)
and [gen_samples.py](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\gen_samples.py>).
CER/WER computed on whitespace-normalized text (see
[metrics.py](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\metrics.py>));
WER only for whitespace-tokenized scripts. Per-run JSON with full
`rec_texts`/`rec_scores` in
[results/](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\results>).

### 5.1 Accuracy table (v6-medium default unless noted)

| Sample | Lang/priority | CER | WER | Numeric | Mean conf | Verdict |
|---|---|---|---|---|---|---|
| en_offer | EN Critical | 0.042 | 0.016 | 8/8 | 0.997 | strong |
| en_dense | EN Critical | 0.000 | 0.000 | 8/8 | 0.995 | strong |
| en_table | EN Critical | 0.115* | 0.308* | 5/5 | 0.998 | strong (see *) |
| id_offer | ID Critical | 0.040 | 0.015 | 7/7 | 0.998 | strong |
| ms_offer | MS High | 0.041 | 0.017 | 7/7 | 0.996 | strong |
| ja_offer | JA Critical | 0.159† | — | 8/8 | 0.988 | strong (see †) |
| zh_hant_offer | ZH-Hant High | 0.103‡ | — | 8/8 | 0.962 | strong (see ‡) |
| th_offer (default) | TH Exploratory | 0.811 | — | 3/5 | 0.676 | FAIL — v6 has no Thai |
| th_offer (`lang=th`, v5) | TH Exploratory | 0.036 | — | 4/5§ | 0.941 | good with v5 stack |
| vi_offer | VI Exploratory | 0.092 | 0.435 | 6/7 | 0.961 | weak diacritics |

\* Table CER/WER are metric artifacts: OCR returns one line per cell
(18 lines) while ground truth joins rows with ` | `; every amount
(1,840.00 / 172.50 / 320.00 / 5% / 1,692.50) is exact.
† JA CER is dominated by dropped spaces around colons plus one kanji
error (加工 → 加エ); all 8 numeric fields exact.
‡ ZH-Hant CER is punctuation width (`,` → `，`) and spacing; every
Traditional character is correct, all 8 numeric fields exact.
§ The 5th field fails because OCR wrote `8 ซั่วโมง` (correct Thai
spelling of "hour") while ground truth has the common misspelling
`8 ชั่วโมง` — a ground-truth artifact, arguably an OCR win.

Cross-config quality (same samples, different models):

- v6-small on all 3 EN samples: CER/WER/numerics **identical to medium
  to 4 decimals** (e.g. en_offer CER 0.0424 both).
- v5-Latin on id/ms: CER/WER/numerics **identical to v6-medium**
  (id CER 0.0395, ms CER 0.0407 both).
- `lang="id"` resolves to the identical v6-medium pair and output as
  default (confirmed empirically, not just from code).

### 5.2 Per-language notes

- Indonesian / Malay (Critical/High): no special `lang` needed;
  Rp/RM amounts, `4.500.000`-style dot separators, `%`, and dates all
  exact. Either v6-medium or the 12.5 MB v5-Latin stack reaches the
  same quality on these samples.
- Japanese (Critical): terminology (基本給, 残業手当, 寮費控除),
  `220,000円`-style amounts, `2026年9月1日` dates, `12か月` durations
  all exact. One 工/エ confusion in 加工 is the only content error.
- Traditional Chinese (High): traditional (not simplified) forms
  throughout — 聘僱, 寶島, 嗎 — all correct; NT$ amounts, 小時 working
  hours, month counts exact.
- Thai (Exploratory): **model support, availability, and accuracy are
  three different answers.** No v6 support (default output is
  Latin-script garbage, though confidence correctly collapses to 0.68
  mean with 100% of lines < 0.9). The v5 Thai model
  (`th_PP-OCRv5_mobile_rec`, auto-selected by `lang="th"`) is available
  and accurate (CER 0.036) but slow (42 s, paired with the 84 MB
  server det model).
- Vietnamese (Exploratory): v6 covers the script but systematically
  mangles stacked diacritics (MỜI→MÒI, việc→vic, bắt→bt, giờ→gi),
  costing WER 0.435 and the `8 giờ` numeric. Amounts with dot
  separators (8.000.000) and the date survive. Not ready without
  further work (real-scan validation, possibly a dedicated model).

### 5.3 Representative output vs ground truth (ID sample, v6-medium)

Ground truth:
`Gaji pokok: Rp 4.500.000 per bulan` / `Potongan asuransi: 3% dari
gaji pokok` / `Tanggal mulai: 10 Agustus 2026`
OCR (conf 0.986–1.000): identical on all three lines; full 13-line
output in `results/v6medium_default__id_offer__t1.json`. JA/VI/TH
failure excerpts are quoted in §5.2 and stored in their run JSONs.

## 6. CPU performance and memory

Warm inference, ~1600 px-wide PNG input, plain-paddle CPU mode:

| Config | Simple page | Dense page | Table page | Peak RSS | CPU util* |
|---|---|---|---|---|---|
| v6-medium | 28.4 s (en_offer) | 31.5 s (en_dense) | 17.2 s (en_table) | 423–609 MB | ~32–39% |
| v6-small | 6.9 s | 8.7 s | 4.3 s | 327–393 MB | ~41–44% |
| v5-Latin (id/ms) | 9.7–9.8 s | — | — | 318–328 MB | ~40% |
| v5-Thai | 42.0 s | — | — | 466 MB | ~26% |

\*: Percent of 16 logical cores (medium ≈ 5–6 cores, small ≈ 7 cores).

- Repeated-run consistency: en_offer ×3 → 28.4 / 27.5 / 27.4 s with
  byte-identical text and scores (deterministic; no warm-up drift
  after the first load).
- Cold start: 77 s first-ever init incl. downloads; ~5.5 s per-process
  init with warm cache; ~2 s for a second pipeline in-process.
- 20-page linear EXTRAPOLATION (labelled estimate, not measured):
  medium ≈ 9–10 min, small ≈ 2–3 min per 20 native-resolution pages.
- Concurrency (light probe, small sample): 2 threads sharing one
  `PaddleOCR` instance both succeed (18/18 lines each) with no errors;
  wall 33.2 s vs 16.7 s sequential each — fully serialized, no
  speedup — and peak RSS 533 MB (no memory blowup). Conclusion:
  thread-safe here, but serving concurrency needs a queue/worker
  design, not threads on one instance.

## 7. PDF rendering feasibility (PyMuPDF, no integration)

PyMuPDF 2.1 renders a synthetic 3-page PDF (13 MB from sample PNGs)
fully in-memory (`get_pixmap` → numpy → `predict`, zero intermediate
files). Render cost is negligible next to OCR:

| Render DPI | Pixels | RAM/image | Render s | OCR s (medium) | CER |
|---|---|---|---|---|---|
| 72 | 1600×903 | 4.3 MB | 0.04 | — | — |
| 150 | 3334×1882 | 18.8 MB | 0.07 | 85.0 | 0.0424 |
| 300 | 6667×3763 | 75.3 MB | 0.34 | 112.6 | 0.0424 |

- Detection caps input at `max_side_limit` 4000 px: the 300 DPI render
  is downscaled internally, so 150 and 300 DPI give **identical CER**
  while 300 DPI costs +33% inference time. Rendering above ~150–200
  DPI is pure overhead for this content.
- Upscaling hurts: the same page at native PNG resolution OCRs in
  28 s with the same CER — inference scales superlinearly with pixels.
- Multipage (150 DPI, in-RAM): 76.1 / 74.5 / 90.4 s per page with the
  same CERs as the PNG originals. Realistic scanned-page budget on
  this CPU is therefore 30–90 s/page (medium) or roughly 4x less
  (small) — measure, don't assume.
- In-memory processing is practical end to end; see
  [bench_render.py](<D:\Projects\HybridAI Firebase Project\benchmarks\paddleocr-phase0\bench_render.py>).

## 8. Privacy and temporary-file handling

- `predict()` wrote **no document-derived files**: no `predict_input`
  copies (that directory was never created), `func_ret/` and `temp/`
  empty, `tmp/` empty after all runs.
- Content grep for five unique sample strings (EN/ID/JA/ZH names and
  places) across `home/` and `tmp/`: **zero hits**.
- `save_to_img`/`save_to_json` were never called. `results/*.json`
  (rec_texts + scores) are the explicitly documented diagnostic and
  are kept intentionally as benchmark evidence.
- Model cache (`official_models/`, 267 MB total) holds only model
  files and sits separate from any document artifact; `.cache/` is
  0.1 MB.
- No writes outside the benchmark dir: `~/.paddlex`, `~/.paddleocr`,
  `~/.cache/paddle` were never created (verified absent).
- Not private: during inference each page exists simultaneously as
  upload bytes, numpy arrays, and model tensors in one unsandboxed
  process, and scores/texts persist in `results/`. Transient handling
  plus cleanup is good hygiene, not a privacy guarantee.

## 9. Acceptance criteria verdicts

| Target | Verdict |
|---|---|
| Successful CPU-only installation | PASS — pinned stack installs cleanly; CPU runtime confirmed |
| No dependency changes to OpporCheck | PASS — backend venv identical; only `benchmarks/` added |
| Reliable OCR inference using the 3.x API | PASS with flag — requires `enable_mkldnn=False` on this CPU |
| Indonesian and English suitable for further evaluation | PASS — CER ≈ 0.04, all numerics exact |
| Japanese suitable for further evaluation | PASS — all numerics exact, one kanji error noted |
| Critical numeric fields correct in tested samples | PASS for EN/ID/MS/JA/ZH-Hant (51/51); VI 6/7, TH-default 3/5 fail as documented |
| Warm inference time reported, not assumed | PASS — §6 table, all measured |
| Peak RAM and cache size measured | PASS — 609 MB max RSS (medium); 12.5–132.7 MB per config |
| No unintentional persistence of document artifacts | PASS — verified by grep + dir inspection |

Not production readiness: clean synthetic images only (no skew, blur,
noise, handwriting, or real scans); single page size; one machine;
Thai/Vietnamese need real-document validation; serving design
(queues, timeouts, page caps) untested.

## 10. Limitations and next steps

1. Validate on real scans (regression set with skew/blur/stamps) —
   synthetic CERs are an upper bound on quality.
2. Re-test `enable_mkldnn` on the deployment CPU; if oneDNN works
   there, re-benchmark (expect faster medium inference).
3. Evaluate PP-OCRv6_tiny and v6-small on ID/MS/JA/ZH (small was only
   run on EN) — small is the current value sweet spot.
4. Decide the Thai path (v5 stack is slow/heavy: 92 MB, 42 s) and
   whether Vietnamese needs a dedicated model or is out of scope.
5. Set the model-hoster bypass + persistent cache home as deployment
   requirements (gotchas §3.3, §3.1).
6. Cap render resolution at ~150–200 DPI; never pay for 300 DPI.

## Appendix — artifact index

Scripts: `bench_env.py` (cache redirect), `gen_samples.py`
(synthetic inputs), `probe_init.py` (first-run probe),
`probe_net.py` (hoster diagnosis), `bench_ocr.py` (18-run quality +
perf matrix), `bench_render.py` (PyMuPDF + multipage),
`bench_concurrency.py` (2-thread probe), `metrics.py` (CER/WER).
Data: `samples/` (9 PNG + ground truths + `multipage3.pdf`),
`results/` (18 run JSONs + `summary.json`), `pip-freeze.txt`.
Caches: `home/` (267 MB models), `tmp/` (empty), `.venv/` (1002 MB).
To reproduce: create the venv, `pip install` the §3 pins, run the
`bench_*.py` scripts in order; every script is standalone.
