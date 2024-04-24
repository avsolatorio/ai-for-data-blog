from sentence_transformers import SentenceTransformer

model = SentenceTransformer('avsolatorio/GIST-all-MiniLM-L6-v2')

# Load the WDI dataset
import pandas as pd

wdi = pd.read_excel('semantic-search/data/WDIEXCEL.xlsx', sheet_name='Series')

wdi["definition"] = wdi["Long definition"]
wdi.loc[wdi["definition"].isnull(), "definition"] = wdi.loc[wdi["definition"].isnull(), "Short definition"]

# Generate embeddings
text_input = wdi['Indicator Name'] + '\n\n' + wdi['definition']

wdi['embedding'] = model.encode(text_input).tolist()

# Save the embeddings
wdi.rename(columns={"Series Code": "code", "Indicator Name": "name"}, inplace=True)

wdi[["code", "name", "embedding"]].to_json("semantic-search/data/wdi_embeddings.json", orient="records")
