import { fromLength } from "../utils";

import type { Tensor, TypedTensor } from "onnxruntime-web";

type NumberTypedArrayConstructor =
	| Int8ArrayConstructor
	| Int16ArrayConstructor
	| Int32ArrayConstructor
	| Uint8ArrayConstructor
	| Uint8ClampedArrayConstructor
	| Uint16ArrayConstructor
	| Uint32ArrayConstructor
	| Float32ArrayConstructor
	| Float64ArrayConstructor;

type BigIntTypedArrayConstructor =
	| BigInt64ArrayConstructor
	| BigUint64ArrayConstructor;

type TypedArrayConstructor = NumberTypedArrayConstructor | BigIntTypedArrayConstructor;

type NumberTypedArray = InstanceType<NumberTypedArrayConstructor>;

type BigIntTypedArray = InstanceType<BigIntTypedArrayConstructor>;

export type TypedArray = InstanceType<TypedArrayConstructor>;

export type DataType<Type> =
	| (Type extends NumberTypedArrayConstructor | NumberTypedArray ? number : never)
	| (Type extends BigIntTypedArrayConstructor | BigIntTypedArray ? bigint : never);

export type Equals<X, Y> = (<T>() => T extends X ? 1 : 0) extends (<T>() => T extends Y ? 1 : 0) ? true : false;

export type Boardcast<ShapeA extends readonly number[], ShapeB extends readonly number[]> = _Boardcast<ShapeA, ShapeB, []>;

type _Boardcast<ShapeA extends readonly number[], ShapeB extends readonly number[], Shape extends readonly number[]> = //
	[ShapeA, ShapeB] extends [
		readonly [...infer RestA extends number[], infer DimA extends number],
		readonly [...infer RestB extends number[], infer DimB extends number],
	] ? true extends Equals<DimA, DimB> | Equals<DimA, 1> | Equals<DimB, 1> //
			? _Boardcast<RestA, RestB, [
				Equals<DimA, 1> extends true ? DimB
					: Equals<DimB, 1> extends true ? DimA
					: DimA | DimB,
				...Shape,
			]>
		: never
		: readonly [...ShapeA, ...ShapeB, ...Shape];

export type ShapeOf<A extends NDArray<TypedArray, readonly number[]>> = A extends NDArray<TypedArray, infer Shape> ? Shape : never;

export type IndicesOfShape<T extends readonly unknown[]> = { [P in keyof T]: number };

type Insert<Target extends readonly unknown[], Index extends number, Element> = //
	`${Index}` extends `-${infer NegatedIndex extends number}` //
		? _InsertFromEnd<Target, NegatedIndex, Element, []>
		: _InsertFromStart<Target, Index, Element, []>;

type _InsertFromStart<Target extends readonly unknown[], Index extends number, Element, Temp extends readonly unknown[]> = //
	Equals<Temp["length"], Index> extends true ? readonly [...Temp, Element, ...Target]
		: Target extends readonly [infer Current, ...infer Rest] ? _InsertFromStart<Rest, Index, Element, [...Temp, Current]>
		: readonly [...Temp, Element];

type _InsertFromEnd<Target extends readonly unknown[], Index extends number, Element, Temp extends readonly unknown[]> = //
	// Adjusted: expand_dims(-1) should insert the element at the very end of the array, not one to the end
	Equals<[...Temp, 0]["length"], Index> extends true ? readonly [...Target, Element, ...Temp]
		: Target extends readonly [...infer Rest, infer Current] ? _InsertFromEnd<Rest, Index, Element, [Current, ...Temp]>
		: readonly [Element, ...Temp];

type SignedIndices = ["+" | "-", number];

type SeparateIndices<Indices extends number> = Indices extends unknown //
	? `${Indices}` extends `-${infer NegatedIndices extends number}` //
		? ["-", NegatedIndices]
	: ["+", Indices]
	: never;

// Includes 0
type PositiveIndices<Indices extends SignedIndices> = Indices extends ["+", infer PositiveValues] ? PositiveValues : never;

type NegativeIndices<Indices extends SignedIndices> = Indices extends ["-", infer NegativeValues] ? NegativeValues : never;

export type Remove<Target extends readonly unknown[], Indices extends number> = _Remove<Target, SeparateIndices<Indices>, [], []>;

type _Remove<Target extends readonly unknown[], Indices extends SignedIndices, ReverseTarget extends readonly unknown[], Temp extends readonly unknown[]> = //
	Target extends readonly [...infer Rest, infer Current] //
		? _Remove<
			Rest,
			Indices,
			readonly [Current, ...Temp],
			Rest["length"] extends PositiveIndices<Indices> ? Temp
				: [Current, ...ReverseTarget]["length"] extends NegativeIndices<Indices> ? Temp
				: readonly [Current, ...Temp]
		>
		: Temp;

export type Swap<Target extends readonly unknown[], Source extends number, Dest extends number> = //
	Equals<Source | Dest, -1 | -2> extends true //
		? Target extends readonly [...infer Rest, infer T2, infer T1] ? readonly [...Rest, T1, T2] : never
		: Target[number][]; // TODO

export default class NDArray<Type extends TypedArray, const Shape extends readonly number[]> {
	readonly ndim: number;
	readonly strides: readonly number[];
	readonly size: number;

	constructor(public readonly shape: Shape, public readonly data: Type) {
		const strides = new Array(this.ndim = shape.length);
		let stride = 1;
		for (let i = shape.length - 1; i >= 0; i--) {
			strides[i] = stride;
			stride *= shape[i];
		}
		this.strides = strides;
		this.size = stride;
	}

	static zeros<const Shape extends readonly number[], Constructor extends TypedArrayConstructor>(shape: Shape, Constructor: Constructor) {
		const size = shape.reduce((acc, val) => acc * val, 1);
		return new NDArray(shape, new Constructor(size) as InstanceType<Constructor>);
	}

	static grid<const Shape extends readonly number[], Constructor extends TypedArrayConstructor>(shape: Shape, Constructor: Constructor, callback: (...indices: IndicesOfShape<Shape>) => DataType<InstanceType<Constructor>>) {
		return NDArray.zeros(shape, Constructor).map((_, ...indices) => callback(...indices));
	}

	static async fromTensor<const Shape extends readonly number[], TensorType extends Exclude<Tensor.Type, "string" | "bool">>(tensor: TypedTensor<TensorType>) {
		return new NDArray(tensor.dims as Shape, await tensor.getData());
	}

	static vectorize<Constructor extends TypedArrayConstructor>(
		fn: (arrayOrScalarA: DataType<Constructor>, arrayOrScalarB: DataType<Constructor>) => DataType<Constructor>,
		Constructor: Constructor,
	): <
		ArrayOrScalarA extends NDArray<TypedArray, readonly number[]> | number | bigint,
		ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> | number | bigint,
	>(arrayOrScalarA: ArrayOrScalarA, arrayOrScalarB: ArrayOrScalarB) => NDArray<
		InstanceType<Constructor>,
		ArrayOrScalarA extends NDArray<TypedArray, readonly number[]> //
			? ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> //
				? Boardcast<ShapeOf<ArrayOrScalarA>, ShapeOf<ArrayOrScalarB>>
			: ShapeOf<ArrayOrScalarA>
			: ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> //
				? ShapeOf<ArrayOrScalarB>
			: never
	>;

	static vectorize(
		fn: (arrayOrScalarA: number | bigint, arrayOrScalarB: number | bigint) => number | bigint,
		Constructor: TypedArrayConstructor,
	) {
		return <
			ArrayOrScalarA extends NDArray<TypedArray, readonly number[]> | number | bigint,
			ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> | number | bigint,
		>(arrayOrScalarA: ArrayOrScalarA, arrayOrScalarB: ArrayOrScalarB): NDArray<
			TypedArray,
			ArrayOrScalarA extends NDArray<TypedArray, readonly number[]> //
				? ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> //
					? Boardcast<ShapeOf<ArrayOrScalarA>, ShapeOf<ArrayOrScalarB>>
				: ShapeOf<ArrayOrScalarA>
				: ArrayOrScalarB extends NDArray<TypedArray, readonly number[]> //
					? ShapeOf<ArrayOrScalarB>
				: never
		> => {
			if (arrayOrScalarA instanceof NDArray) {
				if (arrayOrScalarB instanceof NDArray) {
					const resultNdim = Math.max(arrayOrScalarA.ndim, arrayOrScalarB.ndim);
					const resultShape = fromLength(resultNdim, i => Math.max(arrayOrScalarA.shape[arrayOrScalarA.ndim - resultNdim + i] || 1, arrayOrScalarB.shape[arrayOrScalarB.ndim - resultNdim + i] || 1));
					const result = NDArray.zeros(resultShape, Constructor);
					(function recursive(indices: number[]) {
						const shape = resultShape[indices.length];
						for (let index = 0; index < shape; index++) {
							const newIndices = [...indices, index];
							if (newIndices.length < resultNdim) {
								recursive(newIndices);
							}
							else {
								result.set(
									fn(
										arrayOrScalarA.get(...newIndices.map((index, i) => (arrayOrScalarA.shape[arrayOrScalarA.ndim - resultNdim + i] || 1) === 1 ? 0 : index)),
										arrayOrScalarB.get(...newIndices.map((index, i) => (arrayOrScalarB.shape[arrayOrScalarB.ndim - resultNdim + i] || 1) === 1 ? 0 : index)),
									),
									...newIndices,
								);
							}
						}
					})([]);
					return result as never;
				}
				else {
					return new NDArray(arrayOrScalarA.shape, arrayOrScalarA.data.map(value => fn(value, arrayOrScalarB) as never)) as never;
				}
			}
			else {
				if (arrayOrScalarB instanceof NDArray) {
					return new NDArray(arrayOrScalarB.shape, arrayOrScalarB.data.map(value => fn(arrayOrScalarA, value) as never)) as never;
				}
				else {
					return fn(arrayOrScalarA, arrayOrScalarB) as never;
				}
			}
		};
	}

	reshape<const Shape extends readonly number[]>(shape: Shape) {
		return new NDArray(shape, this.data);
	}

	expandDims<const Axis extends number>(axis: Axis) {
		const newShape = [...this.shape];
		// Adjusted: expandDims(-1) should insert the element at the very end of the array, not one to the end
		newShape.splice(axis < 0 ? axis + this.ndim + 1 : axis, 0, 1);
		return new NDArray(newShape as readonly number[] as Insert<Shape, Axis, 1>, this.data);
	}

	map(callback: (this: this, value: DataType<Type>, ...indices: IndicesOfShape<Shape>) => DataType<Type>) {
		return new NDArray(
			this.shape,
			this.data.map((value, i) => callback.call(this, value as never, ...this.toIndices(i) as never) as never) as Type,
		);
	}

	private toIndices(index: number) {
		const coords = [];
		for (let i = 0; i < this.ndim; i++) {
			const stride = this.strides[i];
			coords[i] = Math.floor(index / stride);
			index -= coords[i] * stride;
		}
		return coords as IndicesOfShape<Shape>;
	}

	private fromIndices(coords: IndicesOfShape<Shape>): number {
		let index = 0;
		for (let i = 0; i < coords.length; i++) {
			index += coords[i] * (this.strides[i] || 0);
		}
		return index;
	}

	get(...indices: IndicesOfShape<Shape>) {
		return this.data[this.fromIndices(indices)] as DataType<Type>;
	}

	set(value: DataType<Type>, ...indices: IndicesOfShape<Shape>) {
		this.data[this.fromIndices(indices)] = value;
	}
}
