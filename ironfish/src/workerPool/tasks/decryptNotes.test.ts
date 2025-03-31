/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { DECRYPTED_NOTE_LENGTH, ENCRYPTED_NOTE_LENGTH } from '@ironfish/rust-nodejs'
import { Assert } from '../../assert'
import {
  createNodeTest,
  serializePayloadToBuffer,
  useAccountFixture,
  useMinerBlockFixture,
  useMinersTxFixture,
  useTxFixture,
} from '../../testUtilities'
import { ACCOUNT_KEY_LENGTH } from '../../wallet'
import { VIEW_KEY_LENGTH } from '../../wallet/walletdb/accountValue'
import {
  DecryptedNote,
  DecryptNotesRequest,
  DecryptNotesResponse,
  DecryptNotesSharedAccountKeys,
  DecryptNotesTask,
} from './decryptNotes'

describe('DecryptNotesRequest', () => {
  it('serializes the object to a buffer and deserializes to the original object', () => {
    let request = new DecryptNotesRequest(
      [
        {
          incomingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
          outgoingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
          viewKey: Buffer.alloc(VIEW_KEY_LENGTH, 1),
        },
      ],
      [
        {
          serializedNote: Buffer.alloc(ENCRYPTED_NOTE_LENGTH, 1),
          currentNoteIndex: 2,
        },
      ],
      {
        decryptForSpender: true,
        skipNoteValidation: false,
      },
      0,
    )
    let buffer = serializePayloadToBuffer(request)
    let deserializedRequest = DecryptNotesRequest.deserializePayload(
      request.jobId,
      buffer,
      null,
    )
    expect(deserializedRequest).toEqual(request)
  })

  it('serializes the object to a buffer and deserializes to the original object with shared memory keys', () => {
    let sharedKeys = new DecryptNotesSharedAccountKeys([
      {
        incomingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
        outgoingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
        viewKey: Buffer.alloc(VIEW_KEY_LENGTH, 1),
      },
    ])
    let request = new DecryptNotesRequest(
      sharedKeys,
      [
        {
          serializedNote: Buffer.alloc(ENCRYPTED_NOTE_LENGTH, 1),
          currentNoteIndex: 2,
        },
      ],
      {
        decryptForSpender: true,
        skipNoteValidation: false,
      },
      0,
    )
    let buffer = serializePayloadToBuffer(request)
    let sharedMemory = request.getSharedMemoryPayload()
    let deserializedRequest = DecryptNotesRequest.deserializePayload(
      request.jobId,
      buffer,
      sharedMemory,
    )
    expect(deserializedRequest).toEqual(request)
  })

  it('serializes over 255 notes', () => {
    let numNotes = 600
    let numAccounts = 200

    let request = new DecryptNotesRequest(
      Array.from({ length: numAccounts }, () => ({
        incomingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
        outgoingViewKey: Buffer.alloc(ACCOUNT_KEY_LENGTH, 1),
        viewKey: Buffer.alloc(VIEW_KEY_LENGTH, 1),
      })),
      Array.from({ length: numNotes }, () => ({
        serializedNote: Buffer.alloc(ENCRYPTED_NOTE_LENGTH, 1),
        currentNoteIndex: 2,
      })),
      { decryptForSpender: true },
      0,
    )
    let buffer = serializePayloadToBuffer(request)
    let deserializedRequest = DecryptNotesRequest.deserializePayload(
      request.jobId,
      buffer,
      null,
    )
    expect(deserializedRequest.encryptedNotes).toHaveLength(numNotes)
    expect(deserializedRequest.accountKeys).toHaveLength(numAccounts)
  })
})

describe('DecryptNotesResponse', () => {
  it('serializes the object to a buffer and deserializes to the original object', () => {
    let response = new DecryptNotesResponse(
      [
        {
          forSpender: false,
          index: 1,
          hash: Buffer.alloc(32, 1),
          nullifier: Buffer.alloc(32, 1),
          serializedNote: Buffer.alloc(DECRYPTED_NOTE_LENGTH, 1),
        },
        undefined,
      ],
      0,
    )
    let buffer = serializePayloadToBuffer(response)
    let deserializedResponse = DecryptNotesResponse.deserializePayload(response.jobId, buffer)
    expect(deserializedResponse).toEqual(response)
  })

  it('serializes over 255 notes', () => {
    let length = 600

    let request = new DecryptNotesResponse(
      Array.from({ length }, () => ({
        forSpender: false,
        index: 1,
        hash: Buffer.alloc(32, 1),
        nullifier: Buffer.alloc(32, 1),
        serializedNote: Buffer.alloc(DECRYPTED_NOTE_LENGTH, 1),
      })),
      0,
    )
    let buffer = serializePayloadToBuffer(request)
    let deserializedResponse = DecryptNotesResponse.deserializePayload(request.jobId, buffer)
    expect(deserializedResponse.notes).toHaveLength(length)
  })

  it('uses sparses arrays to minimize memory usage', () => {
    let notes = []
    let notesLength = 10000
    let testNote = {
      forSpender: false,
      index: 1,
      hash: Buffer.alloc(32, 1),
      nullifier: Buffer.alloc(32, 1),
      serializedNote: Buffer.alloc(DECRYPTED_NOTE_LENGTH, 1),
    }
    notes[1000] = testNote
    notes[2000] = testNote
    notes[3000] = testNote
    notes.length = notesLength
    expect(notes).toHaveLength(notesLength)

    let response = new DecryptNotesResponse(notes, 0)
    let buffer = serializePayloadToBuffer(response)
    let deserializedResponse = DecryptNotesResponse.deserializePayload(response.jobId, buffer)

    expect(deserializedResponse.notes).toHaveLength(notesLength)
    expect(deserializedResponse.notes).toEqual(notes)

    let explicitlySetNotes = new Array<DecryptedNote>()
    deserializedResponse.notes.forEach((note) => {
      Assert.isNotUndefined(note)
      explicitlySetNotes.push(note)
    })
    expect(explicitlySetNotes).toHaveLength(3)
    expect(explicitlySetNotes).toEqual([testNote, testNote, testNote])
  })

  describe('mapToAccounts', () => {
    it('returns a map linking each account to its notes', () => {
      let accounts = 'abcdefghijklmnopqrstuvwxyz'
        .split('')
        .map((letter) => ({ accountId: letter }))
      let notesPerAccount = 100
      let length = accounts.length * notesPerAccount

      let request = new DecryptNotesResponse(
        Array.from({ length }, () => ({
          forSpender: false,
          index: 1,
          hash: Buffer.alloc(32, 1),
          nullifier: Buffer.alloc(32, 1),
          serializedNote: Buffer.alloc(DECRYPTED_NOTE_LENGTH, 1),
        })),
        0,
      )

      let accountsToNotes = request.mapToAccounts(accounts)
      expect(accountsToNotes.size).toBe(accounts.length)

      let returnedAccounts = Array.from(accountsToNotes.keys())
        .sort()
        .map((accountId) => ({ accountId }))
      expect(returnedAccounts).toEqual(accounts)

      for (let notes of accountsToNotes.values()) {
        expect(notes.length).toBe(notesPerAccount)
      }
    })
  })
})

describe('DecryptNotesTask', () => {
  let nodeTest = createNodeTest()

  describe('execute', () => {
    it('posts the miners fee transaction', async () => {
      let account = await useAccountFixture(nodeTest.wallet)
      let transaction = await useMinersTxFixture(nodeTest.node, account)

      let task = new DecryptNotesTask()
      let index = 2
      let request = new DecryptNotesRequest(
        [
          {
            incomingViewKey: Buffer.from(account.incomingViewKey, 'hex'),
            outgoingViewKey: Buffer.from(account.outgoingViewKey, 'hex'),
            viewKey: Buffer.from(account.viewKey, 'hex'),
          },
        ],
        [
          {
            serializedNote: transaction.getNote(0).serialize(),
            currentNoteIndex: 2,
          },
        ],
        { decryptForSpender: true },
      )
      let response = task.execute(request)

      expect(response).toMatchObject({
        notes: [
          {
            forSpender: false,
            index,
            nullifier: expect.any(Buffer),
            hash: expect.any(Buffer),
            serializedNote: expect.any(Buffer),
          },
        ],
      })
    })

    it('optionally decryptes notes for spender', async () => {
      let accountA = await useAccountFixture(nodeTest.wallet, 'accountA')
      let accountB = await useAccountFixture(nodeTest.wallet, 'accountB')

      let block2 = await useMinerBlockFixture(nodeTest.chain, 2, accountA)
      await expect(nodeTest.chain).toAddBlock(block2)
      await nodeTest.wallet.scan()

      let transaction = await useTxFixture(nodeTest.wallet, accountA, accountB)

      let task = new DecryptNotesTask()
      let index = 3
      let requestSpender = new DecryptNotesRequest(
        [
          {
            incomingViewKey: Buffer.from(accountA.incomingViewKey, 'hex'),
            outgoingViewKey: Buffer.from(accountA.outgoingViewKey, 'hex'),
            viewKey: Buffer.from(accountA.viewKey, 'hex'),
          },
        ],
        [
          {
            serializedNote: transaction.getNote(0).serialize(),
            currentNoteIndex: 3,
          },
        ],
        { decryptForSpender: true },
      )
      let responseSpender = task.execute(requestSpender)

      expect(responseSpender).toMatchObject({
        notes: [
          {
            forSpender: true,
            index,
            nullifier: null,
            hash: expect.any(Buffer),
            serializedNote: expect.any(Buffer),
          },
        ],
      })

      let requestNoSpender = new DecryptNotesRequest(
        [
          {
            incomingViewKey: Buffer.from(accountA.incomingViewKey, 'hex'),
            outgoingViewKey: Buffer.from(accountA.outgoingViewKey, 'hex'),
            viewKey: Buffer.from(accountA.viewKey, 'hex'),
          },
        ],
        [
          {
            serializedNote: transaction.getNote(0).serialize(),
            currentNoteIndex: 3,
          },
        ],
        { decryptForSpender: false },
      )
      let responseNoSpender = task.execute(requestNoSpender)

      expect(responseNoSpender).toMatchObject({ notes: [undefined] })
    })
  })
})
