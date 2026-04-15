import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

export function createApp(): express.Application {
  const app = express()

  /* ------------------------------ Body Parsing ------------------------------ */
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  app.use(cookieParser())

  return app
}
