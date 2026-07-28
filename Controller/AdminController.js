
import AppVersion from "../Models/appVersion.js";

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