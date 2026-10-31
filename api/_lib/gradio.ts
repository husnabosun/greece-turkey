import { Client } from '@gradio/client';
import { LEAF_SPACE, type LeafPredict } from '../../src/lib/ai/leaf';

// One connection is kept while the function instance is warm, so the next photo does not connect again.
let connection: Promise<Client> | null = null;

/** Sends one photo to the leaf model in the Hugging Face Space (api_name "predict") and returns its JSON answer. */
export const predictLeaf: LeafPredict = async (image, token) => {
  connection ??= Client.connect(LEAF_SPACE, token ? { token: token as `hf_${string}` } : {});
  try {
    const client = await connection;
    const result = await client.predict('/predict', [new Blob([image.bytes as BlobPart], { type: image.mime })]);
    return (result.data as unknown[])[0];
  } catch (error) {
    connection = null; // connect again next time
    throw error;
  }
};
