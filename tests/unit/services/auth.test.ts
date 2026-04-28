import { beforeEach, describe, expect, it, vi } from 'vitest'

// These mocks isolate registerUser from DB/crypto side effects so the test
// verifies registration behavior (flow + payloads), not third-party internals.
const mockUserFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockAuditLogCreate = vi.fn()
const mockPrismaTransaction = vi.fn()
const mockHashPassword = vi.fn()

// Mock the prisma module. This is a common pattern in unit tests to isolate the code being tested from the underlying dependencies.
vi.mock('../../../src/lib/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: mockUserFindUnique,
      },
      $transaction: mockPrismaTransaction,
    },
  }
})

vi.mock('../../../src/lib/crypto.js', async () => {
  const actualCryptoModule = await vi.importActual('../../../src/lib/crypto.js')
  return {
    ...actualCryptoModule,
    hashPassword: mockHashPassword,
  }
})

describe('registerUser', () => {
  beforeEach(() => {
    // Reset call history between tests to keep assertions deterministic.
    vi.clearAllMocks()
  })

  it('should create a user and write audit log for valid registration input', async () => {
    const registerInput = {
      email: 'new.user@example.com',
      password: 'StrongPassword123!',
    }
    const requestMetadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest-suite',
    }
    const createdUser = {
      id: 'user-123',
      email: registerInput.email,
    }
    // Arrange successful registration: email is new and password is hashable.
    mockUserFindUnique.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue('hashed-password-value')
    mockUserCreate.mockResolvedValue(createdUser)
    mockAuditLogCreate.mockResolvedValue(undefined)
    // Execute the transaction callback with mocked tx methods to assert
    // both user creation and audit logging happen in one transactional path.
    mockPrismaTransaction.mockImplementation(async (handler: Function) => {
      return handler({
        user: {
          create: mockUserCreate,
        },
        auditLog: {
          create: mockAuditLogCreate,
        },
      })
    })
    const { registerUser } = await import('../../../src/services/auth.service.js')
    const actualResult = await registerUser(registerInput, requestMetadata)
    // Assert contract result + critical side effects used by the workflow.
    expect(actualResult).toEqual({
      outcome: 'created',
      userId: createdUser.id,
    })
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: {
        email: registerInput.email,
      },
    })
    expect(mockHashPassword).toHaveBeenCalledWith(registerInput.password)
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: {
        email: registerInput.email,
        passwordHash: 'hashed-password-value',
      },
    })
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: createdUser.id,
        action: 'user.registered',
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          email: createdUser.email,
        },
      },
    })
  })
})
