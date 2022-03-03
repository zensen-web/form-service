---
layout: default
title: Initialization
permalink: /guide/initialization/
parent: Guide
nav_order: 1
---

# Initialization

The `FormService` is an ES6 class, so it can be instantiated via constructor.

```js
import { FormService } from '@zensen/form-service'

const MODEL = {}

const SELECTORS = {}

const onChange = (dirty, state, errors, pristine) => {
  console.info('dirty:', dirty)
  console.info('state:', state)
  console.info('errors:', errors)
  console.info('pristine:', pristine)
}

const formService = new FormService(MODEL, SELECTORS, onChange)
```

## Arguments: 

- `model`: input data model that represents the form's data
- `selectors`: a map of configurable behaviors can be invoked on keys within the form's data
- `onChange`: callback that is invoked whenever the form's state is changed

_Note_: All `FormService` operations are synchronous, so any asynchronous tasks need to be handled outside of `FormService`.

## `onChange()` Callback:

This callback is invoked immediately after any mutation occurs to `FormService`'s state, including initialization. This callback is meant as a hook to sync the form component's renderable props with `FormService`'s own state.

The callback is invoked with the following parameters:

- `dirty`: flag denote if the current state of the form has deviated from its initial state
- `state`: the form's current state
- `errors`: an object containing any error messages
- `pristine`: an object containing flags denoting which keys have been touched since initialization
