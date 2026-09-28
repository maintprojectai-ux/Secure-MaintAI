# Model 02-A — RCAEval Technical Failure Specialist

## Status

The Python implementation has been structurally validated with an offline self-test.

Real-data training is intentionally not claimed in this environment because the full RCAEval telemetry files are not present locally and this execution environment cannot download them directly. The official RCAEval repository currently provides RE1/RE2 on Hugging Face and documents the data structure and case index.

## Run with real RCAEval data

Download the desired suite locally, then run:

```bash
python model_02a_rcaeval.py --data-root /path/to/RCAEval --suite re2
```
python model_02a_rcaeval.py --data-root data/rcaeval --suite all
Or run both RE1 and RE2:

```bash
python model_02a_rcaeval.py --data-root /path/to/RCAEval --suite all
```

First verify the implementation:

```bash
python model_02a_rcaeval.py --self-test
```

## Method

* Case-grouped train/test split.
* No target/ground-truth metadata in features.
* Chronological fixed-size windows within each case.
* Window labels use RCAEval injection time only to define the post-fault training target; `inject_time` is never a model feature.
* Semantic aggregation is based on metric names, not RCAEval-specific feature identities.
* Random Forest is the primary candidate; Logistic Regression is the baseline.
* The model predicts technical failure type only. It does not decide cyber vs technical and it does not trigger SOAR.
