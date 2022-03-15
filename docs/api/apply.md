---
layout: default
title: apply(path, value)
permalink: /apply/
parent: API
nav_order: 1
---

# `apply(path, value)`

Arguments:

- `path`
  - Type: `String`
  - Description: path to the target key
- `value`
  - Type: depends on the key in the state
  - Description: value to set the desired key to in the state

## Example

```js
import FormService from '@zensen/form-service'

const MODEL = {
  firstName: '',
  lastName: '',
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('firstName', 'Tony')
```

Output:

```console
state: {
  firstName: 'Tony',
  lastName: '',
}
```

## Restrictions

- Only a single key can ever be modified along its branch in the `state` tree
- `apply()` cannot be applied to object-type keys unless `clipPristine` is set on that key's selector
- Objects that can be modified must not alter the shape of that schema with the exception of going between null/object states
- The `unsafe` modifier flag can be set on keys in exceptional cases (such as multi-selects) where object/array mutations are required
