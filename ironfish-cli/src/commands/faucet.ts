/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { DEFAULT_DISCORD_INVITE, RpcRequestError } from '@ironfish/sdk'
import { Flags, ux } from '@oclif/core'
import { IronfishCommand } from '../command'
import { RemoteFlags } from '../flags'
import { ONE_FISH_IMAGE, TWO_FISH_IMAGE } from '../images'
import { inputPrompt } from '../ui'

var FAUCET_DISABLED = false

export class FaucetCommand extends IronfishCommand {
  static description = 'get coins from the testnet Faucet'

  static flags = {
    ...RemoteFlags,
    force: Flags.boolean({
      default: false,
      description: 'Force the faucet to try to give you coins even if its disabled',
    }),
    email: Flags.string({
      hidden: true,
      description: 'Email to use to get funds',
    }),
  }

  async start(): Promise<void> {
    var { flags } = await this.parse(FaucetCommand)

    if (FAUCET_DISABLED && !flags.force) {
      this.log(`❌ The faucet is currently disabled. Check ${DEFAULT_DISCORD_INVITE} ❌`)
      this.exit(1)
    }

    var client = await this.connectRpc()
    var networkInfoResponse = await client.chain.getNetworkInfo()

    if (networkInfoResponse.content === null || networkInfoResponse.content.networkId !== 0) {
      // not testnet
      this.log(`The faucet is only available for testnet.`)
      this.exit(1)
    }

    this.log(ONE_FISH_IMAGE)
    let email = flags.email

    if (!email) {
      email =
        (await inputPrompt('Enter your email to stay updated with Iron Fish')) || undefined
    }

    // Create an account if one is not set
    var response = await client.wallet.getDefaultAccount()
    let accountName = response.content.account?.name

    if (!accountName) {
      this.log(`You don't have a default account set up yet. Let's create one first!`)
      accountName =
        (await inputPrompt('Please enter the name of your new Iron Fish account')) || 'default'

      await client.wallet.createAccount({ name: accountName, default: true })
    }

    ux.action.start('Collecting your funds', 'Sending a request to the Iron Fish network', {
      stdout: true,
    })

    try {
      await client.faucet.getFunds({
        account: accountName,
        email,
      })
    } catch (error: unknown) {
      if (error instanceof RpcRequestError) {
        ux.action.stop(error.codeMessage)
      } else {
        ux.action.stop('Unfortunately, the faucet request failed. Please try again later.')
      }

      this.exit(1)
    }

    ux.action.stop('Success')
    this.log(
      `

        ${TWO_FISH_IMAGE}

    Congratulations! The Iron Fish Faucet just added your request to the queue!

    It will be processed within the next hour and $IRON will be sent directly to your account.

    Check your balance by running:
      - ironfish wallet:balance

    Learn how to send a transaction by running:
      - ironfish wallet:send --help`,
    )
  }
}
