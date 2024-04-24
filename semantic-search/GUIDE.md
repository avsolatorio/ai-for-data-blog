# Guide

This document contains some guide for setting up the project, processing the models, and running the code.

## Model conversion and quantization

The transformers.js library uses ONNX models. To convert a Hugging Face model to ONNX, you can use the `optimum-cli` tool. The following commands show how to convert a Hugging Face model to ONNX and quantize it using the `optimum-cli` tool.
sentence-transformers/all-MiniLM-L6-v2
```bash
poetry run optimum-cli export onnx -m avsolatorio/GIST-all-MiniLM-L6-v2 GIST_all_MiniLM_L6_v2_onnx/
poetry run optimum-cli onnxruntime quantize \
  --avx512 \
  --onnx_model GIST_all_MiniLM_L6_v2_onnx \
  -o GIST_all_MiniLM_L6_v2_onnx_quantized

# poetry run optimum-cli export onnx -m sentence-transformers/all-MiniLM-L6-v2 st_all_MiniLM_L6_v2_onnx
# poetry run optimum-cli onnxruntime quantize \
#   --avx512 \
#   --onnx_model st_all_MiniLM_L6_v2_onnx \
#   -o st_all_MiniLM_L6_v2_onnx_quantized
```


We then upload this to the hugginface model repository. The onnx models must be in the `onnx/` folder in the repository.

```bash
git clone https://huggingface.co/avsolatorio/GIST-all-MiniLM-L6-v2
cd GIST-all-MiniLM-L6-v2 && mkdir onnx && cd onnx

# Copy the onnx model
rsync -avP ../../GIST_all_MiniLM_L6_v2_onnx/model.onnx onnx/

# Copy the quantized onnx model
rsync -avP ../../GIST_all_MiniLM_L6_v2_onnx_quantized/model_quantized.onnx onnx/
rsync -avP ../../GIST_all_MiniLM_L6_v2_onnx_quantized/ort_config.json onnx/

# Commit and push
git add onnx
git commit -m "Add onnx models"
git push
```


## Testing the ONNX model

```Python
import numpy as np

from onnxruntime import InferenceSession
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("avsolatorio/GIST-all-MiniLM-L6-v2")
sess = InferenceSession("hf_models/GIST-all-MiniLM-L6-v2-onnx/onnx/model_quantized.onnx")

model_out = model.encode("Convert this to a vector")

text = "Convert this to a vector"

onnx_input = model.tokenize([text])

onnx_input.pop("token_type_ids", None)

onnx_input["input_ids"] = onnx_input["input_ids"].numpy()
onnx_input["attention_mask"] = onnx_input["attention_mask"].numpy()

onnx_out = sess.run(None, onnx_input)

assert np.dot(model_out.flatten(), onnx_out[1].flatten()) > 0.99
```
