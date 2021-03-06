import {
  AnyAction,
  Action,
  Reducer,
  Observable,
  StoreEnhancer,
  PreloadedState,
  Store as ReduxStore
} from 'redux'
import { ClientOptions, ClientMeta, CrossTabClient } from '@logux/client'
import { Unsubscribe } from 'nanoevents'
import { Log } from '@logux/core'

export type LoguxUndoAction = {
  type: 'logux/undo'
  id: string
  reason?: string
}

export type LoguxUndoError = Error & {
  action: LoguxUndoAction
}

export interface LoguxDispatch<A extends Action> {
  <T extends A>(action: T): T

  /**
   * Add sync action to log and update store state.
   * This action will be visible only for server and all browser tabs.
   *
   * ```js
   * store.dispatch.sync(
   *   { type: 'CHANGE_NAME', name },
   *   { reasons: ['lastName'] }
   * ).then(meta => {
   *   store.log.removeReason('lastName', { maxAdded: meta.added - 1 })
   * })
   * ```
   *
   * @param action The new action.
   * @param meta Action’s metadata.
   * @returns Promise when action will be processed by the server.
   */
  sync<T extends A>(action: T, meta?: Partial<ClientMeta>): Promise<ClientMeta>

  /**
   * Add cross-tab action to log and update store state.
   * This action will be visible only for all tabs.
   *
   * ```js
   * store.dispatch.crossTab(
   *   { type: 'CHANGE_FAVICON', favicon },
   *   { reasons: ['lastFavicon'] }
   * ).then(meta => {
   *   store.log.removeReason('lastFavicon', { maxAdded: meta.added - 1 })
   * })
   * ```
   *
   * @param action The new action.
   * @param meta Action’s metadata.
   * @returns Promise when action will be saved to the log.
   */
  crossTab<T extends A>(
    action: T,
    meta?: Partial<ClientMeta>
  ): Promise<ClientMeta>

  /**
   * Add local action to log and update store state.
   * This action will be visible only for current tab.
   *
   * ```js
   *
   * store.dispatch.local(
   *   { type: 'OPEN_MENU' },
   *   { reasons: ['lastMenu'] }
   * ).then(meta => {
   *   store.log.removeReason('lastMenu', { maxAdded: meta.added - 1 })
   * })
   * ```
   *
   * @param action The new action.
   * @param meta Action’s metadata.
   * @returns Promise when action will be saved to the log.
   */
  local<T extends A>(action: T, meta?: Partial<ClientMeta>): Promise<ClientMeta>
}

export interface ReduxStateListener<S, A extends Action> {
  (state: S, prevState: S, action: A, meta: ClientMeta): void
}

export class LoguxReduxStore<
  S = any,
  A extends Action = AnyAction,
  H extends object = {},
  L extends Log = Log<ClientMeta>
> implements ReduxStore<S, A> {
  /**
   * Logux synchronization client.
   */
  client: CrossTabClient<H, L>

  /**
   * The Logux log.
   */
  log: L

  /**
   * Promise until loading the state from IndexedDB.
   */
  initialize: Promise<void>

  /**
   * Add action to log with Redux compatible API.
   */
  dispatch: LoguxDispatch<A>

  /**
   * Subscribe for store events. Supported events:
   *
   * * `change`: when store was changed by action.
   *
   * ```js
   * store.on('change', (state, prevState, action, meta) => {
   *   console.log(state, prevState, action, meta)
   * })
   * ```
   *
   * @param event The event name.
   * @param listener The listener function.
   * @returns Unbind listener from event.
   */
  on (event: 'change', listener: ReduxStateListener<S, A>): Unsubscribe

  /**
   * Reads the state tree managed by the store.
   *
   * @returns The current state tree of your application.
   */
  getState (): S

  /**
   * Adds a change listener.
   *
   * @param listener A callback to be invoked on every dispatch.
   * @returns A function to remove this change listener.
   */
  subscribe (listener: () => void): Unsubscribe

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * @param nextReducer The reducer for the store to use instead.
   */
  replaceReducer (nextReducer: Reducer<S, A>): void

  [Symbol.observable] (): Observable<S>
}

export interface LoguxStoreCreator<
  H extends object = {},
  L extends Log = Log<ClientMeta>
> {
  <S, A extends Action = Action, Ext = {}, StateExt = {}>(
    reducer: Reducer<S, A>,
    enhancer?: StoreEnhancer<Ext, StateExt>
  ): LoguxReduxStore<S & StateExt, A, H, L> & Ext
  <S, A extends Action = Action, Ext = {}, StateExt = {}>(
    reducer: Reducer<S, A>,
    preloadedState?: PreloadedState<S>,
    enhancer?: StoreEnhancer<Ext>
  ): LoguxReduxStore<S & StateExt, A, H, L> & Ext
}

export type LoguxReduxOptions = ClientOptions & {
  /**
   * How many actions without `meta.reasons` will be kept for time travel.
   * Default is `1000`.
   */
  reasonlessHistory?: number

  /**
   * How often save state to history. Default is `50`.
   */
  saveStateEvery?: number

  /**
   * Callback when there is no history to replay actions accurate.
   */
  onMissedHistory?: (action: Action) => void

  /**
   * How often we need to clean log from old actions. Default is every `25`
   * actions.
   */
  cleanEvery?: number
}

/**
 * Creates Logux client and connect it to Redux createStore function.
 *
 * ```js
 * import { createLoguxCreator } from '@logux/redux'
 *
 * const createStore = createLoguxCreator({
 *   subprotocol: '1.0.0',
 *   server: process.env.NODE_ENV === 'development'
 *     ? 'ws://localhost:31337'
 *     : 'wss://logux.example.com',
 *   userId: userId.content
 *   token: token.content
 * })
 *
 * const store = createStore(reducer)
 * store.client.start()
 * ```
 *
 * @param config Logux Client config.
 * @returns Redux’s `createStore` compatible function.
 */
export function createLoguxCreator<
  H extends object = {},
  L extends Log = Log<ClientMeta>
> (config: LoguxReduxOptions): LoguxStoreCreator<H, L>
