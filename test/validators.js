import pkg from 'validator'

export const isPhoneNumber = {
  error: 'Invalid phone number',
  validate: v => !v || pkg.isMobilePhone(v),
}
