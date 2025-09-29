#!/usr/bin/env node

import { Command } from 'commander'

import { login } from './commands/login/index.js'
import { env } from './commands/env/index.js'
import { cognito } from './commands/cognito/index.js'

const program = new Command()
program.name('oz').description('awscli macros').version('1.0.0-alpha.1')
program.addCommand(login)
program.addCommand(env)
program.addCommand(cognito)
program.parse()
