const express = require('express')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')
const validate = require('../middleware/validate')
const { updateUserSchema } = require('../validations/authSchemas')
const adminController = require('../controllers/adminController')

const router = express.Router()

// GET /api/admin/users — Admin only
router.get('/users', auth, roleCheck('admin'), adminController.getUsers)

// PUT /api/admin/users/:id — Admin only
router.put('/users/:id', auth, roleCheck('admin'), validate(updateUserSchema), adminController.updateUser)

// DELETE /api/admin/users/:id — Admin only (soft delete)
router.delete('/users/:id', auth, roleCheck('admin'), adminController.deactivateUser)

module.exports = router
