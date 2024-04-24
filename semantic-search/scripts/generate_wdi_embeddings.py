import os
import pandas as pd
import fire
from sentence_transformers import SentenceTransformer


def main(model_name: str = "avsolatorio/GIST-all-MiniLM-L6-v2"):
    _, base_model = model_name.split("/")
    data_dir = os.path.join(os.path.dirname(__file__), '../data')

    model = SentenceTransformer(model_name)

    # Load the WDI dataset
    wdi = pd.read_excel(os.path.join(data_dir, "WDIEXCEL.xlsx"), sheet_name='Series')

    # Generate input text
    wdi["definition"] = wdi["Long definition"]
    wdi.loc[wdi["definition"].isnull(), "definition"] = wdi.loc[wdi["definition"].isnull(), "Short definition"]

    text_input = wdi['Indicator Name'] + '\n\n' + wdi['definition']

    # Generate embeddings
    wdi['embedding'] = model.encode(text_input, show_progress_bar=True).tolist()

    # Process and save the embeddings
    wdi.rename(columns={"Series Code": "code", "Indicator Name": "name"}, inplace=True)

    wdi[["code", "name", "embedding"]].to_json(os.path.join(data_dir, f"{base_model}__wdi_embeddings.json"), orient="records")


if __name__ == "__main__":
    # poetry run python semantic-search/scripts/generate_wdi_embeddings.py --model_name="avsolatorio/GIST-all-MiniLM-L6-v2"
    fire.Fire(main)