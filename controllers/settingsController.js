const { supabase } = require('../config/supabase');

const settingsController = {
  // Get user settings
  getUserSettings: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { category } = req.query;

      let query = supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId);

      if (category) {
        query = query.eq('setting_category', category);
      }

      const { data, error } = await query;

      if (error) {
        error.status = 500;
        throw error;
      }

      // Transform settings into a more usable format
      const settings = {};
      (data || []).forEach(setting => {
        if (!settings[setting.setting_category]) {
          settings[setting.setting_category] = {};
        }
        settings[setting.setting_category][setting.setting_key] = setting.setting_value;
      });

      res.json({
        message: 'Settings retrieved successfully',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  },

  // Update or create setting
  updateSetting: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { category, key, value } = req.body;

      if (!category || !key || value === undefined) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'category, key, and value are required'
        });
      }

      // Validate category
      const validCategories = ['clinic_info', 'appointment_booking', 'patient_records', 'environment_support'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Invalid category',
          message: `Category must be one of: ${validCategories.join(', ')}`
        });
      }

      // Upsert setting
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          user_id: userId,
          setting_category: category,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,setting_category,setting_key'
        })
        .select()
        .single();

      if (error) {
        error.status = 500;
        throw error;
      }

      res.json({
        message: 'Setting updated successfully',
        data: data
      });
    } catch (error) {
      next(error);
    }
  },

  // Update multiple settings
  updateSettings: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { category, settings } = req.body;

      if (!category || !settings || typeof settings !== 'object') {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'category and settings object are required'
        });
      }

      const validCategories = ['clinic_info', 'appointment_booking', 'patient_records', 'environment_support'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Invalid category',
          message: `Category must be one of: ${validCategories.join(', ')}`
        });
      }

      // Prepare settings for upsert
      const settingsToUpsert = Object.entries(settings).map(([key, value]) => ({
        user_id: userId,
        setting_category: category,
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('settings')
        .upsert(settingsToUpsert, {
          onConflict: 'user_id,setting_category,setting_key'
        })
        .select();

      if (error) {
        error.status = 500;
        throw error;
      }

      res.json({
        message: 'Settings updated successfully',
        data: data
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete setting
  deleteSetting: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { category, key } = req.params;

      const { error } = await supabase
        .from('settings')
        .delete()
        .eq('user_id', userId)
        .eq('setting_category', category)
        .eq('setting_key', key);

      if (error) {
        error.status = 500;
        throw error;
      }

      res.json({
        message: 'Setting deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = settingsController;

