/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as VerifyImport } from './routes/verify'
import { Route as MachinesImport } from './routes/machines'
import { Route as AboutImport } from './routes/about'
import { Route as IndexImport } from './routes/index'
import { Route as FlowsFlowidImport } from './routes/flows/$flowid'

// Create/Update Routes

const VerifyRoute = VerifyImport.update({
  id: '/verify',
  path: '/verify',
  getParentRoute: () => rootRoute,
} as any)

const MachinesRoute = MachinesImport.update({
  id: '/machines',
  path: '/machines',
  getParentRoute: () => rootRoute,
} as any)

const AboutRoute = AboutImport.update({
  id: '/about',
  path: '/about',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const FlowsFlowidRoute = FlowsFlowidImport.update({
  id: '/flows/$flowid',
  path: '/flows/$flowid',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/about': {
      id: '/about'
      path: '/about'
      fullPath: '/about'
      preLoaderRoute: typeof AboutImport
      parentRoute: typeof rootRoute
    }
    '/machines': {
      id: '/machines'
      path: '/machines'
      fullPath: '/machines'
      preLoaderRoute: typeof MachinesImport
      parentRoute: typeof rootRoute
    }
    '/verify': {
      id: '/verify'
      path: '/verify'
      fullPath: '/verify'
      preLoaderRoute: typeof VerifyImport
      parentRoute: typeof rootRoute
    }
    '/flows/$flowid': {
      id: '/flows/$flowid'
      path: '/flows/$flowid'
      fullPath: '/flows/$flowid'
      preLoaderRoute: typeof FlowsFlowidImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/about': typeof AboutRoute
  '/machines': typeof MachinesRoute
  '/verify': typeof VerifyRoute
  '/flows/$flowid': typeof FlowsFlowidRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/about': typeof AboutRoute
  '/machines': typeof MachinesRoute
  '/verify': typeof VerifyRoute
  '/flows/$flowid': typeof FlowsFlowidRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/about': typeof AboutRoute
  '/machines': typeof MachinesRoute
  '/verify': typeof VerifyRoute
  '/flows/$flowid': typeof FlowsFlowidRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/about' | '/machines' | '/verify' | '/flows/$flowid'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/about' | '/machines' | '/verify' | '/flows/$flowid'
  id: '__root__' | '/' | '/about' | '/machines' | '/verify' | '/flows/$flowid'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  AboutRoute: typeof AboutRoute
  MachinesRoute: typeof MachinesRoute
  VerifyRoute: typeof VerifyRoute
  FlowsFlowidRoute: typeof FlowsFlowidRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  AboutRoute: AboutRoute,
  MachinesRoute: MachinesRoute,
  VerifyRoute: VerifyRoute,
  FlowsFlowidRoute: FlowsFlowidRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/about",
        "/machines",
        "/verify",
        "/flows/$flowid"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/about": {
      "filePath": "about.tsx"
    },
    "/machines": {
      "filePath": "machines.tsx"
    },
    "/verify": {
      "filePath": "verify.tsx"
    },
    "/flows/$flowid": {
      "filePath": "flows/$flowid.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
