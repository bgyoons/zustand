type SetStateInternal<T> = {
  _(
    partial: T | Partial<T> | { _(state: T): T | Partial<T> }['_'],
    replace?: false,
  ): void
  _(state: T | { _(state: T): T }['_'], replace: true): void
}['_']

export interface StoreApi<T> {
  setState: SetStateInternal<T>
  getState: () => T
  getInitialState: () => T
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
}

export type ExtractState<S> = S extends { getState: () => infer T } ? T : never

type Get<T, K, F> = K extends keyof T ? T[K] : F

export type Mutate<S, Ms> = number extends Ms['length' & keyof Ms]
  ? S
  : Ms extends []
    ? S
    : Ms extends [[infer Mi, infer Ma], ...infer Mrs]
      ? Mutate<StoreMutators<S, Ma>[Mi & StoreMutatorIdentifier], Mrs>
      : never

export type StateCreator<
  T,
  Mis extends [StoreMutatorIdentifier, unknown][] = [],
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
  U = T,
> = ((
  setState: Get<Mutate<StoreApi<T>, Mis>, 'setState', never>,
  getState: Get<Mutate<StoreApi<T>, Mis>, 'getState', never>,
  store: Mutate<StoreApi<T>, Mis>,
) => U) & { $$storeMutators?: Mos }

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface StoreMutators<S, A> {}
export type StoreMutatorIdentifier = keyof StoreMutators<unknown, unknown>

type CreateStore = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ): Mutate<StoreApi<T>, Mos>

  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>,
  ) => Mutate<StoreApi<T>, Mos>
}

type CreateStoreImpl = <
  T,
  Mos extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [], Mos>,
) => Mutate<StoreApi<T>, Mos>

const createStoreImpl: CreateStoreImpl = (createState) => {
  type TState = ReturnType<typeof createState>
  type Listener = (state: TState, prevState: TState) => void

  // 상태와 리스너 선언
  let state: TState
  const listeners: Set<Listener> = new Set()

  // closure
  // state와 listeners에 접근 가능한 클로저를 형성
  const setState: StoreApi<TState>['setState'] = (partial, replace) => {
    // 업데이트 될 상태 선언
    const nextState =
      typeof partial === 'function'
        ? (partial as (state: TState) => TState)(state)
        : partial

    // 업데이트 될 상태와 현재 상태 비교해서 업데이트함
    if (!Object.is(nextState, state)) {
      const previousState = state
      state =
        // replace가 nullish하지 않고 boolean이면
        (replace ?? (typeof nextState !== 'object' || nextState === null))
          ? (nextState as TState) // true면 통으로 바꿈 state = nextState
          : Object.assign({}, state, nextState) // false면 일부만 업데이트
      // 상태 병합 (기본 동작)
      // setState({ count: 5 })
      // 상태 완전 대체
      // setState({ count: 5 }, true)

      // listeners에 등록된 모든 구독자 함수(listener)에 상태가 변경되었음을 알림
      // React 컴포넌트가 상태 변화를 감지하고 리렌더링할 수 있음
      listeners.forEach((listener) => listener(state, previousState))
    }
  }

  // closure
  const getState: StoreApi<TState>['getState'] = () => state

  // closure
  const getInitialState: StoreApi<TState>['getInitialState'] = () =>
    initialState

  // closure
  const subscribe: StoreApi<TState>['subscribe'] = (listener) => {
    listeners.add(listener)
    // Unsubscribe
    return () => listeners.delete(listener)
  }

  const api = { setState, getState, getInitialState, subscribe }
  // createState는 다음과 같은 형식
  // set >> setState, get >> getState가 되는거임
  // createState = (set, get) => ({
  //   firstName: '',
  //   lastName: '',
  //   updateFirstName: (firstName) => set(() => ({ firstName: firstName })),
  //   updateLastName: (lastName) => set(() => ({ lastName: lastName })),
  // })
  // 매개변수로 받은 createState로 state의 초기값 설정
  const initialState = (state = createState(setState, getState, api))
  return api as any
}

// create 함수 내부에서 다시 호출되고 있음
// const api = createStore(createState)
export const createStore = ((createState) =>
  createState ? createStoreImpl(createState) : createStoreImpl) as CreateStore
