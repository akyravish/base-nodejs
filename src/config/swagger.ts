import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node.js Boilerplate API',
      version: '1.0.0',
      description: 'Production-ready Node.js + Express + TypeScript boilerplate',
    },
    servers: [{ url: '/api', description: 'API server' }],
  },
  apis: ['./src/modules/**/*.route.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)
