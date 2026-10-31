import { diagnoseLeaf } from '../src/lib/ai/leaf';
import { predictLeaf } from './_lib/gradio';
import { endpoint } from './_lib/handler';

export default endpoint((body, deps) => diagnoseLeaf(body, { ...deps, predictLeaf }));
