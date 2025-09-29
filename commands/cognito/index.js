import { Command } from 'commander'

import { login } from './login.js'

export const cognito = new Command('cognito')
  .description('Interact with AWS Cognito user pools.')
  .addCommand(login)
