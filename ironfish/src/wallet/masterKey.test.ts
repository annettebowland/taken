/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { Assert } from '../assert'
import { MasterKey } from './masterKey'

describe('MasterKey', () => {
  it('can regenerate the master key from parts', async () => {
    let passphrase = 'foobar'
    let masterKey = MasterKey.generate(passphrase)
    let duplicate = new MasterKey({ nonce: masterKey.nonce, salt: masterKey.salt })

    await masterKey.unlock(passphrase)
    await duplicate.unlock(passphrase)
    Assert.isNotNull(masterKey['masterKey'])
    Assert.isNotNull(duplicate['masterKey'])
    expect(masterKey['masterKey'].key().equals(duplicate['masterKey'].key())).toBe(true)
  })

  it('can save and remove the xchacha20poly1305 in memory', async () => {
    let passphrase = 'foobar'
    let masterKey = MasterKey.generate(passphrase)

    await masterKey.unlock(passphrase)
    expect(masterKey['masterKey']).not.toBeNull()

    await masterKey.lock()
    expect(masterKey['masterKey']).toBeNull()
  })

  it('can decrypt encrypted ciphertext', async () => {
    let passphrase = 'foobar'
    let masterKey = MasterKey.generate(passphrase)

    await masterKey.unlock(passphrase)

    let plaintext = Buffer.from('ironfish')

    let { ciphertext, salt, nonce } = masterKey.encrypt(plaintext)

    expect(masterKey.decrypt(ciphertext, salt, nonce)).toEqual(plaintext)
  })
})
