---
layout: default
title: "unformat()"
permalink: /selectors-and-modifiers/unformat/
parent: Selectors and Modifiers
grand_parent: Guide
nav_order: 2
---

# unformat(value, keyPath, state)

It's generally necessary to convert the current UI state of the form back into its agnostic data model counterpart when the user is ready to submit the data to the API. This is achieved by defining `unformat()` modifiers to selectors that also define  the `format()` modifier, allowing `FormService` to know how to undo format operations. The unformat process is triggered by calling the `build()` method the `FormService` instance.

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  quantity: 4,
}

const SELECTORS = {
  children: {
    quantity: {
      format: v => `${v} Gil`,
      unformat: v => Number(v.split(' ')[0]),
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange) // 1.

formService.apply('quantity', '1000 Gil') // 2.

const result = formService.build() // 3.

console.log('result:', result)

```

Output:

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  quantity: '4',
}
```

```console
result: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  quantity: 1000,
}
```

The previous example does the following:

1. Builds an instance of `FormService`, building an internal state from the input data model with `format()`
1. Calls `formService.apply()` to set the value of `quantity` to `1000 Gil` (more on this method later)
1. Calls `formService.build()` that builds a new model object from the internal form state with `unformat()`

`unformat()` works very similarly to [`format()`](/selectors-and-formatters/format) is on selectors. There are two main differences:
1. `unformat()` is triggered by `build()` while `format()` is trigger on instantiation (as mentioned above)
1. The 3rd parameter to `unformat()` is the current form's UI state instead of the input data model
