
import AppVersion from "../Models/appVersion.js";
import User from "../Models/User.js";

export const setAppVersion = async (req, res) => {
     try {

    const appVersion = await AppVersion.findOneAndUpdate(
      {},
      {
        $set: req.body
      },
      {
        returnDocument: "after",
        upsert: true,
        projection: {
          createdAt: 0,
          updatedAt: 0,
          __v: 0
        }
      }
    );

    res.json({
      message: "App version updated successfully",
      data: appVersion
    });

    } catch(error) {
        res.status(500).json({
        message: error.message
        });
    }

}
export const getAppVersion = async (req, res) => {
    try {
        const appVersion = await AppVersion.findOne({},{
            createdAt: 0,
            updatedAt: 0,
            __v: 0
        })
        res.json({
            message: "App version retrieved successfully",
            data: appVersion
        });
    } catch(error) {
        res.status(500).json({
            message: error.message
        });
    }
}

/** TEMP — remove after one-off profile image fix */
export const tempAdminSetProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "profileImage file is required (multipart field: profileImage)",
      });
    }

    const profileImage = `images/${req.uploadFolder}/${file.filename}`;
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage },
      { new: true, projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "TEMP: profileImage updated",
      data: {
        userId: user._id,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};