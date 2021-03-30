function printValue (v) {
  return typeof v === 'object' ? JSON.stringify(v, '', 2) : v
}

export class ValidationError extends Error {
}

export class VerificationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'VerificationError'
  }
}

export class PristineError extends Error {
  constructor (keyPath) {
    super(`Selector (${keyPath.join('.')}) cannot have pristine state`)
    this.name = 'PristineError'
  }
}

export class MutationError extends Error {
  constructor (keyPath, oldValue, newValue) {
    super(`Reshaping on mutation not allowed at path: ${keyPath.join('.')}
Old Value: ${printValue(oldValue)}
New Value: ${printValue(newValue)}`)
    this.name = 'MutationError'
  }
}

export class PathError extends Error {
  constructor (keyPath) {
    super(`No key found in state for path: ${keyPath.join('.')}`)
    this.name = 'PathError'
  }
}
