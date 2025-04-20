import React from 'react'
import { createStore } from './vanilla.ts'
import type {
  ExtractState,
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from './vanilla.ts'

type ReadonlyStoreApi<T> = Pick<
  StoreApi<T>,
  'getState' | 'getInitialState' | 'subscribe'
>

const identity = <T>(arg: T): T => arg
export function useStore<S extends ReadonlyStoreApi<unknown>>(
  api: S,
): ExtractState<S>

export function useStore<S extends ReadonlyStoreApi<unknown>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U,
): U

// export function useSyncExternalStore<Snapshot>(
//   subscribe: (onStoreChange: () => void) => () => void,
//   getSnapshot: () => Snapshot,
//   getServerSnapshot?: () => Snapshot,
// ): Snapshot;
// store의 변화 감지 담당
export function useStore<TState, StateSlice>(
  api: ReadonlyStoreApi<TState>,
  selector: (state: TState) => StateSlice = identity as any,
) {
  const slice = React.useSyncExternalStore(
    api.subscribe,
    () => selector(api.getState()),
    () => selector(api.getInitialState()),
  )
  React.useDebugValue(slice)
  return slice
}

export type UseBoundStore<S extends ReadonlyStoreApi<unknown>> = {
  (): ExtractState<S>
  <U>(selector: (state: ExtractState<S>) => U): U
} & S

type Create = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ): UseBoundStore<Mutate<StoreApi<T>, Mos>>
  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ) => UseBoundStore<Mutate<StoreApi<T>, Mos>>
}

const createImpl = <T>(createState: StateCreator<T, [], []>) => {
  // createStore을 다시 호출하고 있음
  // createStore가 상태 생성 및 변경을 담당
  // { setState, getState, getInitialState, subscribe }를 리턴함
  // state, listeners에 간접적으로 접근 가능
  // 오직 반환된 API 메서드를 통해서만 상태에 접근하고 조작 >> 상태 변경이 항상 제어된 방식으로만 이루어지도록 보장
  const api = createStore(createState)

  const useBoundStore: any = (selector?: any) => useStore(api, selector)

  Object.assign(useBoundStore, api)

  return useBoundStore
}

export const create = (<T>(createState: StateCreator<T, [], []> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create

// 스토어 생성 예시 (create 함수의 매개변수로 전달)
// const usePersonStore = create<State & Action>((set) => ({
//   firstName: '',
//   lastName: '',
//   updateFirstName: (firstName) => set(() => ({ firstName: firstName })),
//   updateLastName: (lastName) => set(() => ({ lastName: lastName })),
// }))
