const User = require('../models/User')
const ActivityLog = require('../models/ActivityLog')

const adminController = {
  // GET /api/admin/users — Full user management listing
  async getUsers(req, res, next) {
    try {
      const { role, zone, isActive, search, page = 1, limit = 50 } = req.query
      const filter = {}
      if (role) filter.role = role
      if (zone) filter.zone = zone
      if (isActive !== undefined) filter.isActive = isActive === 'true'
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]
      }

      const skip = (parseInt(page) - 1) * parseInt(limit)
      const users = await User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))

      const total = await User.countDocuments(filter)

      // Stats
      const stats = {
        totalUsers: await User.countDocuments(),
        admins: await User.countDocuments({ role: 'admin' }),
        operators: await User.countDocuments({ role: 'operator' }),
        citizens: await User.countDocuments({ role: 'user' }),
        active: await User.countDocuments({ isActive: true }),
        inactive: await User.countDocuments({ isActive: false }),
      }

      res.json({
        success: true,
        data: users,
        total,
        stats,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      })
    } catch (error) {
      next(error)
    }
  },

  // PUT /api/admin/users/:id — Update user
  async updateUser(req, res, next) {
    try {
      const { name, role, department, zone, isActive, phone } = req.body
      const user = await User.findById(req.params.id)
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

      // Prevent self-demotion
      if (req.user.id.toString() === user._id.toString() && role && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Cannot change your own admin role.' })
      }

      if (name) user.name = name
      if (role) user.role = role
      if (department) user.department = department
      if (zone) user.zone = zone
      if (isActive !== undefined) user.isActive = isActive
      if (phone !== undefined) user.phone = phone
      await user.save()

      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Updated User',
        module: 'admin',
        details: `Updated user ${user.email}: role=${user.role}, zone=${user.zone}, active=${user.isActive}`,
      })

      res.json({ success: true, data: user })
    } catch (error) {
      next(error)
    }
  },

  // DELETE /api/admin/users/:id — Deactivate user (soft delete)
  async deactivateUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id)
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

      if (req.user.id.toString() === user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot deactivate yourself.' })
      }

      user.isActive = false
      await user.save()

      await ActivityLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Deactivated User',
        module: 'admin',
        details: `Deactivated ${user.email}`,
      })

      res.json({ success: true, message: `User ${user.email} deactivated.` })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = adminController
