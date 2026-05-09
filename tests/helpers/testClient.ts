import supertest from 'supertest'

import { createApp } from '../../src/app.js'

/** Supertest client wrapping the Express app. Use in all route-level tests. */
export const testClient = supertest(createApp())
