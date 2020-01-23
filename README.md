# zensen-form-service

A reactive form service framework

## Features

- Facilitates form state
- Triggers efficient re-renders for reactive components
- Keeps track of state dirtiness
- Handles complex data structures
- Provides a validation framework

This was created as a form solution for `LitElement`, but it can work with other reactive component packages such as `React`.

## Install

Using `npm`:

```
$ npm install @zensen/router
```

Using `yarn`:

```
$ yarn add @zensen/router
```

## API

### Initialization

The `FormService` is an ES6, so it can be instantiated via constructor.

```js
import { FormService } from '@zensen/form-service'

const MODEL = {}

const SELECTORS = {}

const onChange = (dirty, state, errors) => {
  console.info('dirty:', dirty)
  console.info('state:', state)
  console.info('errors:', errors)
}

const formService = new FormService(MODEL, SELECTORS, onChange)

```

Arguments: 
- `model`: input data model that represents the form state
- `selectors`: selectors map are configurable behaviors that are invoked on different keys.
- `onChange`: callback that is invoked whenever the form's state is changed.

### The Input Model

The data model should represent the form's state in a more portable format that is agnostic to any particular UI requirements. The response payload to API requests commonly act as the input model.

A deep copy of the input model is made when passed to `FormService`'s constructor, and used as its internal state that it.

During this process, selectors may be invoked on keys to transform the copied data into a format that is consumable for your web components.

_NOTE:_ The input data model is never mutated.

A common example of this is when a form key property with a value of type `Number` in the model will be represented as a value in a textfield.

The textfield will want to manipulate it as a string:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  price: {
    format: v => toCurrency(v),
  },
}

const onChange = (_dirty, state) => {
  console.log('state:', state)
}

const formService = new FormService(MODEL, SELECTORS, onChange)
```

The `onChange()` callback is invoked after initialization, and yields the following `state`:

Here's the following output:

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

The `FormService` copied the `id` and `name` keys over as-in, but the `price` was changed from a `Number` type to a `String` with additional formatting.

### Exporting State with `buildModel()`

This method returns a new copy of the form's current state in an agnostic format. Selectors may be invoked on keys that define the `unformat()` property like so:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  price: {
    format: v => toCurrency(v),
    unformat: v => toNumber(v),
  },
}

const onChange = (_dirty, state) => {
  console.log('state:', state)
}

const formService = new FormService(MODEL, SELECTORS, onChange)

const result = formService.buildModel()
console.log('result:', result)
```

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}

result: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}
```

The `FormService` copied over its state as usual by formatting the `price` key to a currency-formatted string, and the model that was returned provided the `price` key's value as a `Number` as a result of `unformat()` being defined on its selector.

_NOTE:_ It's a best practice to always provide selectors with `unformat()` alongside with `format()` and vice-versa to maintain data-context consistency.

### Changing State with `apply()`

This method is used to make changes to the form's state that deviate from its initial state. This is generally called as a result of a web component changing due to user interaction. Making changes is simple:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Tony Stark',
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('name', 'Anthony Stark')
```

```console
// state when initialized
state: {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Tony Stark',
}

// state when change is applied
state: {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Anthony Stark',
}
```

### Dirtiness

Another deep copy is performed on the state during initialization. This serves as an initial snapshot, so `FormService` can keep track of deviations in state when its state is manipulated.

For example, given the scenario:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  price: {
    format: v => toCurrency(v),
    unformat: v => toNumber(v),
  },
}

const onChange = (dirty, state) => {
  console.log('dirty:', dirty, 'state:', state)
}

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Here is the initial output:

```console
dirty: false,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

Then, let's apply a change to dirtiness:

```js
formService.apply('name', 'Craft Beer')
```

Yields the following output:

```console
dirty: true,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Craft Beer',
  price: '$4.00',
}
```

We can apply another change to make the state match its initial state like so:

```js
formService.apply('name', 'Beer')
```

```console
dirty: false,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

### Updating State from Model with `refresh()`

Sometimes the input model changes due to outside circumstances.

A common example is when an updated version of the model has been returned from an API request, and now `FormService` must be reinitialized. The `refresh()` method does just that:

```js
const onResponse => model => formService.refresh(model)
```

This will build a new state and reset any errors. It also rebuilds the initial state, so its dirtiness status is also reset.

### Reverting State with `reset()`

This method current state of `FormService` needs to be reverted back to its initial state, then `reset()`.

```js
const onCancel => () => formService.reset()
```

This also resets dirtiness status.

### Nested Selectors

Selectors can be defined on child keys of sub-objects by defining the `children` property on the parent selector:

```js
const MODEL = {
  name: 'Some one',
  phone: {
    number: '8005551234',
    type: 'work',
  },
}

const SELECTORS = {
  phone: {
    children: {
      number: {
        format: v => toPhoneNumber(v),
        unformat: v => toNumeric(v),
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
const result = formService.buildModel()

console.log('result:', result)
```

Here's the result:

```js
state: {
  name: 'Some one',
  phone: {
    number: '(800) 555-1234',
    type: 'work',
  },
}

result: {
  name: 'Some one',
  phone: {
    number: '8005551234',
    type: 'work',
  },
}
```

The `apply()` method can directly modify nested selectors as well:

```js
formService.apply('phone.type', 'home')
```

```console
state: {
  name: 'Some one',
  phone: {
    number: '(800) 555-1234',
    type: 'home',
  },
}
```

`apply()` also invokes a shallow copy against the parent key, and all ancestor keys of the key that was modified from the deepest level upward.

Here's a simplified illustration of the previous call to `apply()` from above:

```js
this.__state.phone.type = 'home'
this.__state.phone = { ...this.__state.phone }
this.__state = { ...this.__state }
```

This is done to guarantee re-renders for reactive component libraries such as `LitElement` and `React` at every level. This is ideal for cases where the project has wrapper components that group input field components together for higher reusability.

For example: it might make sense for the project to have a _phone-item_ component which takes a phone object as a renderable prop containing `number` and `type` keys which it assigns to its own child components: a _textfield_ _select_ component respectively.

If `this.__state.phone` wasn't re-assigned, then the _phone-item_ component wouldn't re-render. If `this.__state` wasn't re-assigned, then the form component itself wouldn't re-render. Both re-assignments are required to sync the UI with `FormService`'s state.

### Working with Arrays (Coming Soon)

The `FormService` has array support as well:

```js
const MODEL = {
  name: 'Tony Stark',
  aliases: [],
}
```

## Selector Properties

### Flags
- `clipErrors`: flag for object-type keys which will clip its corresponding key in the `errors` schema to a single value instead of an object of values
- `clipPristine`: flag for object-type keys which will clip its corresponding key in the `pristine` schema to a single value instead of an object of values
- `ignorePristine`: removes pristine status from a key

### Functions
- `addItem`: function that generates a new array item for that selector
- `format`: transforms the affect's key's value coming from the input model
- `unformat`: transforms the affect's key's value coming from the state
- `validators`: an array of validators that to invoke against the value of its corresponding key's value whenever its value, or a descendent-key's value is modified
