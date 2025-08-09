/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as helpers_withAuth from "../helpers/withAuth.js";
import type * as jobs_actions from "../jobs/actions.js";
import type * as jobs_authAction from "../jobs/authAction.js";
import type * as jobs_mutations from "../jobs/mutations.js";
import type * as jobs_queries from "../jobs/queries.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "helpers/withAuth": typeof helpers_withAuth;
  "jobs/actions": typeof jobs_actions;
  "jobs/authAction": typeof jobs_authAction;
  "jobs/mutations": typeof jobs_mutations;
  "jobs/queries": typeof jobs_queries;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
