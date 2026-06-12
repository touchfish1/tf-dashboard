import { Hono } from 'hono'
import { getAllPollerStatus } from '../lib/poller-health'

const router = new Hono()

router.get('/', async (c) => {
  return c.json({
    pollers: getAllPollerStatus(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  })
})

export default router
