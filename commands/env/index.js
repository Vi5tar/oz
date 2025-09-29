import { Command } from 'commander'

import { print } from './print.js'
import { clear } from './clear.js'

export const env = new Command('env')
  .description('Manage AWS environment variables.')
  .addCommand(print)
  .addCommand(clear)