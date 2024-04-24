
Reference: https://github.com/huggingface/optimum/blob/main/README.md

```bash
poetry run optimum-cli export onnx -m avsolatorio/GIST-all-MiniLM-L6-v2 GIST_all_MiniLM_L6_v2_onnx/
poetry run optimum-cli onnxruntime quantize \
  --avx512 \
  --onnx_model GIST_all_MiniLM_L6_v2_onnx \
  -o GIST_all_MiniLM_L6_v2_onnx_quantized
```

Example post on transformers.js: https://medium.com/@fareedkhandev/transformers-js-ai-in-the-browser-zero-server-costs-maximum-privacy-2cd8d28798b7
