import { InferenceSession, Tensor } from "onnxruntime-web";
import seedrandom from "seedrandom";
import { setRandom, sampleNormal } from "vega-statistics";

import NDArray from "./NDArray";
import { fromLength } from "../utils";

import type { ModelComponent, ModelComponentToFile } from "../types";
import type { TypedTensor } from "onnxruntime-web";

export const ALL_MODEL_COMPONENTS: readonly ModelComponent[] = ["enc", "emb", "sdp", "flow", "dec"];

type FloatTensor = TypedTensor<"float32">;

const sessionCache = new Map<string, InferenceSession | FloatTensor>();

function loadSession(model: ModelComponentToFile) {
	return Promise.all(
		ALL_MODEL_COMPONENTS.map(async component => {
			const currComponent = model[component];
			const key = `${currComponent.path}/${currComponent.version}`;
			let session = sessionCache.get(key);
			if (!session) {
				session = await InferenceSession.create(currComponent.file);
				if (component === "emb") {
					const { g } = await session.run({ sid: new Tensor("int64", [0]) });
					session = g.reshape([...g.dims, 1]) as FloatTensor;
				}
				sessionCache.set(key, session);
			}
			return session;
		}),
	) as Promise<[enc: InferenceSession, g: FloatTensor, sdp: InferenceSession, flow: InferenceSession, dec: InferenceSession]>;
}

type FloatTensorArray<Shape extends readonly number[]> = NDArray<Float32Array, Readonly<Shape>>;

const transformWeight = NDArray.vectorize((d, m) => Math.ceil(Math.exp(d) * m), Float32Array);
const lessThan = NDArray.vectorize((a, b) => +(a < b), Float32Array);
const multiply = NDArray.vectorize((a, b) => a * b, Float32Array);
const addNoise = NDArray.vectorize((m, p) => sampleNormal(m, 0.8 * Math.exp(p)), Float32Array);

type Batch = number & { readonly brand: unique symbol };
type Tx = number & { readonly brand: unique symbol };
type Ty = number & { readonly brand: unique symbol };
type FeatureDim = number & { readonly brand: unique symbol };

function sequenceMask<Dim extends number>(lengths: FloatTensorArray<[Dim]>, maxLength?: number) {
	if (typeof maxLength === "undefined") maxLength = Math.max(...lengths.data);
	const x = NDArray.grid([maxLength as Ty], Float32Array, i => i);
	return lessThan(x.expandDims(0), lengths.expandDims(1));
}

function transformUsingAttention(attn: FloatTensorArray<[Batch, Tx, Ty]>, data: FloatTensorArray<[Batch, FeatureDim, Tx]>) {
	const [batch, t_x, t_y] = attn.shape;
	const [, feature_dim] = data.shape;

	const result = NDArray.zeros([batch, feature_dim, t_y], Float32Array);
	for (let i = 0; i < batch; i++) {
		for (let j = 0; j < t_y; j++) {
			for (let k = 0; k < t_x; k++) {
				for (let f = 0; f < feature_dim; f++) {
					result.set(result.get(i, f, j) + attn.get(i, k, j) * data.get(i, f, k), i, f, j);
				}
			}
		}
	}
	return result;
}

function generatePath(duration: FloatTensorArray<[Batch, 1, Tx]>, mask: FloatTensorArray<[Batch, 1, Ty, Tx]>) {
	const [batch, , t_y, t_x] = mask.shape;
	let sum: number;
	const cumDuration = duration.map((value, _batch, _, i) => {
		if (!i) sum = 0;
		return sum += value;
	});

	const cumDurationFlat = cumDuration.reshape([batch * t_x]);
	const path = sequenceMask(cumDurationFlat, t_y).reshape([batch, t_x, t_y]);
	return path.map((value, _batch, _tx, _ty) => value ^ (_tx ? path.get(_batch, _tx - 1, _ty) : 0));
}

export default async function infer(model: ModelComponentToFile, seq: number[], tone: number[]) {
	setRandom(seedrandom("42"));
	const [enc, g, sdp, flow, dec] = await loadSession(model);
	const { xout: x, m_p, logs_p, x_mask } = await enc.run({
		x: new Tensor("int64", seq, [1, seq.length]),
		t: new Tensor("int64", tone, [1, tone.length]),
		language: new Tensor("int64", Array.from(seq, () => 0), [1, seq.length]),
		g,
	});
	const zin = new Tensor("float32", fromLength(x.dims[0] * 2 * x.dims[2], () => sampleNormal(0, 0.6)), [x.dims[0], 2, x.dims[2]]);
	const { logw } = await sdp.run({ x, x_mask, zin, g });
	const x_mask_array = await NDArray.fromTensor<[Batch, 1, Tx], "float32">(x_mask as FloatTensor);
	const logw_array = await NDArray.fromTensor<[Batch, 1, Tx], "float32">(logw as FloatTensor);
	const w_ceil = transformWeight(x_mask_array, logw_array);
	const [batch, , t_x] = x_mask_array.shape;
	const y_lengths = NDArray.grid([batch], Float32Array, batch => {
		let sum = 0;
		for (let i = 0; i < t_x; i++) {
			sum += w_ceil.get(batch, 0, i);
		}
		return Math.max(1, Math.min(100000, sum));
	});
	const y_mask_array = sequenceMask(y_lengths).expandDims(1);
	const attn_mask = multiply(x_mask_array.expandDims(2), y_mask_array.expandDims(-1));
	const attn = generatePath(w_ceil, attn_mask);
	const m_p_array = await NDArray.fromTensor<[Batch, FeatureDim, Tx], "float32">(m_p as FloatTensor);
	const logs_p_array = await NDArray.fromTensor<[Batch, FeatureDim, Tx], "float32">(logs_p as FloatTensor);
	const new_m_p = transformUsingAttention(attn, m_p_array);
	const new_logs_p = transformUsingAttention(attn, logs_p_array);
	const z_p = addNoise(new_m_p, new_logs_p);
	const { z: z_in } = await flow.run({
		z_p: new Tensor("float32", z_p.data, z_p.shape),
		y_mask: new Tensor("float32", y_mask_array.data, y_mask_array.shape),
		g,
	});
	const { o: output } = await dec.run({ z_in, g });
	return await output.getData() as Float32Array;
}
