# @zensen/form-service

A reactive form service framework for building dynamic forms.

## Installation

### NPM
```bash
npm install @zensen/form-service
```

### Yarn
```bash
yarn add @zensen/form-service
```

### CDN (jsDelivr)

#### UMD Bundle (Global Variable)
```html
<script src="https://cdn.jsdelivr.net/npm/@zensen/form-service@2.0.29/dist/form-service.umd.min.js"></script>
```

#### ES6 Module
```html
<script type="module">
  import FormService from 'https://cdn.jsdelivr.net/npm/@zensen/form-service@2.0.29/dist/form-service.esm.min.js'
</script>
```

## Usage

### ES6 Modules (NPM)
```javascript
import FormService from '@zensen/form-service'

const formService = new FormService()
```

### Browser (CDN - UMD)
```javascript
// FormService is available globally
const formService = new FormService()
```

### Browser (CDN - ES6 Module)
```javascript
import FormService from 'https://cdn.jsdelivr.net/npm/@zensen/form-service@2.0.29/dist/form-service.esm.min.js'

const formService = new FormService()
```

## Documentation

Full documentation can be found [here](https://zensen-web.github.io/form-service/guide/mutating-key-data/).
