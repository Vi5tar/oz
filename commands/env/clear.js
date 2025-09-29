import { writeSync } from 'node:fs'
import { Command } from 'commander'

export const clear = new Command('clear')
  .description('clear the aws environment variables')
  .action(() => {
    writeSync(3, 'unset AWS_PROFILE\n')
    writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
    writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
    writeSync(3, 'unset AWS_SESSION_TOKEN\n')
    writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
  })
