import fp from 'fastify-plugin'
import compress from '@fastify/compress'

/**
 * This plugin adds compression support to both requests and responses
 * 
 * @see https://github.com/fastify/fastify-compress
 */
export default fp(async (fastify) => {
  fastify.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate']
  })
}) 