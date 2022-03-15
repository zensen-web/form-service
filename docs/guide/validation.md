---
layout: default
title: Validation
permalink: /guide/validation/
parent: Guide
nav_order: 5
---

# Validation

One of the most powerful features of `FormService` is the validation framework that comes built into it. It's surprisingly simple at its surface, yet has a lot of depth when needed. It's as simple or complex as your project requires.

## The `errors` Schema

Each key in the state has its own error message associated to it that `FormService` uses to determine whether or not an error is associated with that key.

When the state is first initialized, an `errors` schema is built internally to match the shape of the state (just like the `pristine` schema).

```js
/* state */

{
  firstName: '',
  lastName: '',
  phones: [
    {
      type: { // "type" is an object that is passed to a dropdown as its "value"
        id: 'home',
        label: 'Home',
      },
      number: '',
    },
  ],
}
```

```js
/* errors */

{
  firstName: '',
  lastName: '',
  phones: [
    {
      type: {
        id: '',
        label: '',
      },
      number: '',
    },
  ],
}
```

Error messages are generated for each leaf-most key by default, similarly to the `pristine` schema, however error messages are meant to line up with keys in the state that have validators associated to it. There is a way to clip the errors schema which will be covered later in this section.

## The `validators` Modifier

Validation is done by defining the `validators` modifier on selectors:

```js
import FormService from '@zensen/form-service'
import { isRequired, isEmail, isPhoneNumber } from '@zensen/form-validators'

import { toPhoneNumber, toNumeric } from './formatters'

const MODEL = {
  phone: { number: '', type: '' },
}

const SELECTORS = {
  children: {
    email: [isRequired(), isEmail()],
    phone: {
      children: {
        number: {
          format: v => toPhoneNumber(v),
          unformat: v => toNumeric(v),
          validators: [isPhoneNumber()],
        },
      },
    },
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

The `validators` modifier is an array, and they can be applied directly to the key as a kind of short-hand if they're the only modifier associated with that key as seen with the `email` key above. The elements in the `validators` array are objects that are meant to define a single point of failure.

### Clipping the `errors` Schema

Defining the `validators` modifier on a selector that represents an object-type key in the form's state will clip that branch in the `errors` schema.

For example, if we provide the following model with no selectors:

```js
import FormService from '@zensen/form-service'
import { isRequired, isEmail, isPhoneNumber } from '@zensen/form-validators'

const MODEL = {
  topKey: {
    subKey: '',
  },
}

const SELECTORS = {}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

This results in the following `errors` schema by default:

```console
errors: {
  topKey: {
    subKey: '',
  },
}
```

However, the `validators` selector is applied to the `topKey` selectors like this:

```js
import FormService from '@zensen/form-service'
import { isRequired, isEmail, isPhoneNumber } from '@zensen/form-validators'

const MODEL = {
  topKey: {
    subKey: '',
  },
}

const SELECTORS = {
  children: {
    topKey: [isRequired()],
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

This results in the following `errors` schema:

```console
errors: {
  topKey: '',
}
```

The `subKey` was clipped, and `topKey` became a leaf key in the schema. This allows sub-keys to trigger validation on parent selectors which will be covered in a future section.

### Restrictions to the `validators` Modifier

Due to the `validators` modifier clipping the `errors` schema, multiple `validators` modifiers cannot be defined along the same branch in the selectors tree.

Here's an example:

```js
const MODEL = {
  a: '',
  b: {
    c: '',
  },
}

const SELECTORS = {
  children: {
    a: [isRequired()], // this is fine
    b: {
      validators: [isRequired()], // this is also fine, and will clip the error schema
      children: {
        c: [isRequired()], // this will cause an error
      },
    },
  },
}
```

The runtime error occurs because `c` is defining validators even though its parent selector, `b`, clips the `errors` schema to this before the selectors for `c` were executed:

```console
errors: {
  a: '',
  b: '',
}
```

If validators weren't provided for `b`, then the following `errors` schema would be built instead:

```console
errors: {
  a: '',
  b: {
    c: '',
  },
}
```

## Defining a Validator

Validators are just objects that contain two properties: the `error` message and the `validate` function.

Here's an example:

```js
const required = {
  error: 'Required',
  validate: (v, _keyPath, _state, _service) => Boolean(v),
}
```

### Using the `validate()` function

When `FormService` needs to process a validator, it executes the validator object's `validate` function that's attached to it. It passes the current value from the state of the key it's associated with into `validate()` among a few other params:

- `v`: value associated
- `keyPath`: the array-separated path to the value in the state (`phones.0.number` is `['phones', '0', 'number']`)
- `state`: the entire form's state
- `service`: reference to the `formService` instance that's executing the validator

The `validate()` function is meant to return a boolean value: `true` if the value passes validation, and `false` if it fails. If a validator fails, then `formService` will assign the validator's error message to that key's error message in the `errors` schema, and stop processing any further validators in the list.

It's a best practice to write validators as functions that return an object, so that its parameters can customize the returned validator object. It's a common convention that the last parameter in the function is an `error` that's auto-assigned to the default message.

`FormService` has a companion package called `@zensen/form-validators` which includes several common validators.

Here's an example of the `isRequired()` validator creator function that comes with it:

```js
export function isRequired (error = 'Required') {
  return {
    error,
    validate: v => (Array.isArray(v)
      ? v.length
      : (typeof v === 'number' ? v : v.trim()))
  }
}
```

### Defining `validateRaw`

A validator's `validate()` function passes in the form's UI `state` by default, but sometimes it's useful to validate the value as its unformatted version instead. For example, there might be a numeric value in the input data model that's formatted to a currency-formatted string to be represented by a textfield in the UI. It's common to want to write validators around the raw, `Number`-type representation of that data. This can be achieved by defining the `validateRaw` modifier on that selector that uses validators.

```js
import FormService from '@zensen/form-service'
import { isRequired } from '@zensen/form-validators'
import { toCurrency, fromCurrency } from './formatters'

const MODEL = {
  price: 100000, // in cents
}

const SELECTORS = {
  children: {
    price: {
      validateRaw: true,
      format: v => toCurrency(v), // 100000 -> '$1,000.00'
      unformat: v => fromCurrency(v), // '$1,000.00' -> 100000
      validators: [
        {
          error: 'Too high',
          validate: v => v <= 100000, // "v" is passed in as cents instead of a string
        },
      ],
    },
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)

formService.unsetPristine(['price']) // allow validators to run on this key
formService.apply('price', '$1,000.01') // will trigger validator error
```

Output:

```console
errors: {
  price: 'Too high',
}
```

The program ran successfully, and generated a validation error instead of a runtime error.

Normally, the `String`-type value of `$1,000.01` would be passed to the validator as `v`, but this isn't the case because the `validateRaw` modifier was enabled on the `price` selector. In fact, this would cause a runtime error because the `<=` operator cannot be used with strings. Instead, `validateRaw` caused the `unformat()` modifier to run against that selector converting `$1,000.01` to `100001`, and passing that to the validator's `validate()` function.

In fact, an entire unformatted model object is created from the current UI state, and passed in as the 3rd parameter of `validate()` whenever `validateRaw` is set.

In other words, the `validateRaw` modifier changes `validate()`'s function signature from this:

```js
validate(v, keyPath, state, service) // `v` comes from the `state`
```

to this:

```js
validate(v, keyPath, model, service) // `v` comes from the new `model` that is also passed in
```

## How Validations Are Triggered

Validation is invoke on a selector when the following conditions are met:
- Either its key or one of its descendent keys are [mutated](/guide/mutating-key-data/)
- The mutated key's corresponding pristineness value in the [`pristine`](/guide/mutating-key-data/) schema is `false`.

For example, merely calling `formService.apply()` once on a key will not trigger validation if this is the first time that the key was mutated. It will unset that key's pristine flag to `false` instead. Then any subsequent calls to `formService.apply()` or any other mutation method will trigger validation.

```js
import FormService from '@zensen/form-service'
import { isRequired } from '@zensen/form-validators'

const MODEL = {
  name: '',
}

const SELECTORS = {
  children: {
    name: [isRequired()],
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)

formService.apply('email', '') // will not trigger validation
```

It might seem weird that a key's initial mutations won't execute any validation behavior, but this is actually out of convenience for input component design. It's a common convention for form input fields to invoke `formService.apply()` on their targeting keys whenever the input field is focused and blurred. This way, form input fields can achieve validation for required fields in the case where a user selects a field, but then blurs it without performing any actual change. There will be more discussion on form input component guide best practices in a later section (see recipes coming soon).

### Alternative Ways to Unset Pristine Status

Sometimes it's useful to unset the pristine status of a key without attempting to mutate any values or process validation.

#### The `unsetPristine(keyPath)` Method

This instance method can be called to unset the pristine flag. This is useful for cases where pristineness needs to be unset due to some conditions being met. For example, maybe a key's pristine flag needs to be unset when a different key is mutated.

```js
import FormService from '@zensen/form-service'
import { isRequired } from '@zensen/form-validators'

const MODEL = {
  name: '',
}

const SELECTORS = {
  children: {
    name: [isRequired()],
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)

formService.unsetPristine(['name']) // unsets pristine status (NOTE: path is array-separated)
formService.apply('name', '') // this will now trigger validation
```

Output:

```console
errors: {
  name: 'Required',
}
```

Note that `formService.unsetPristine()`'s `keyPath` paramter is an array-separated path. So, `phones.0.numbers` would be `['phones', '0', 'numbers']` in array-separated form.

#### The `ignorePristine` Modifier

This works just like `unsetPristine()`, except it's a modifier that can be applied to selectors. This is more of a convenience to unset pristineness upon initialization. This is rarely used, but it's a nice escape hatch.

```js
const MODEL = {
  a: '',
  b: '',
}

const SELECTORS = {
  children: {
    a: {
      ignorePristine: true,
    },
  },
}
```

This is the initial value of the `pristine` schema:

```console
pristine: {
  a: false,
  b: true,
}
```

### The Validation Hierarchy

As mentioned earlier, validations can be bubbled up to ancestor keys:

```js
import FormService from '@zensen/form-service'
import { isPropRequired } from '@zensen/form-validators'

function willFailWhenExecuted() () {
  return {
    error: 'Failed',
    validate: () => false,
  }
}

const MODEL = {
  topKey: {
    subKey: '',
  },
}

const SELECTORS = {
  children: {
    topKey: {
      validators: [willFailWhenExecuted()],
    },
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTORS, onChange)

// unsets pristine values
formService.unsetPristine(['topKey'])
formService.unsetPristine(['subKey'])

formService.apply('topKey.subKey', '') // this will trigger validation on its parent key
```

Output:

```console
errors: {
  topKey: 'Failed'
}
```

The validator, `willFailWhenExecuted()`, was executed, but why? The `subKey` was mutated, but there are no validators defined on the `subKey`. This is because of validator bubbling. When a key is mutated, `FormService` will look for validators on that key. If a `validators` modifier isn't defined for that key, then `FormService` will go to its parent key, check if it has a selector defined, and if so, look for a `validators` modifier. If it's not found, then it'll go to that key's parent key, look for validators on its selector, and so on and so forth, all the way up to the root.

## Manual Validation

There are also a few ways to manually validate keys.

### Validating the Entire State with `validate()`

Calling this method will unset pristine keys for the entire schema, and run all validation on all selectors. `validate()` also returns a boolean value: `true` if all validation passes for all selectors, and `false` if any validator fails for any selector. This method is typically useful for doing any final validation right before submitting the form for storage.

### Validating a Specific Key with `validateKey()`

This method can validate a specific key by providing a `keyPath` to it. It doesn't unset pristineness, unlike `validate()`, but it does have a `force` parameter as an escape hatch to guarantee validation regardless of pristineness.

`validateKey()` has two parameters:

- `keyPath`: array-separated path to the selector with a `validators` modifier defined
- `force`: optional parameter that forces validation regardless of pristine status (auto-assigned to `false`)

### Disabling Automatic Validation with `validateManually`

This modifier disables the selector from automatically processing validation due to mutation operations. Validation will only be run when either `validate()` or `validateKey()` are called.
