import { Command } from 'commander'

export const print = new Command('print')
  .description('print the aws environment variables')
  .action(() => {
    console.log(`AWS_PROFILE=${process.env.AWS_PROFILE ?? ''}`)
    console.log(`AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID ?? ''}`)
    console.log(`AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ?? ''}`)
    console.log(`AWS_SESSION_TOKEN=${process.env.AWS_SESSION_TOKEN ?? ''}`)
    console.log(`AWS_CREDENTIAL_EXPIRATION=${process.env.AWS_CREDENTIAL_EXPIRATION ?? ''}`)
  })
