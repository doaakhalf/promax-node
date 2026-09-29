
import AppVersion from "../Models/appVersion.js";
import ChatSettings, { DEFAULT_FREE_TRIAL_LIMIT } from "../Models/ChatSettings.js";

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

export const getChatSettings = async (req, res) => {
  try {
    const settings = await ChatSettings.findOne(
      {},
      { createdAt: 0, updatedAt: 0, __v: 0 }
    ).lean();

    res.json({
      message: "Chat settings retrieved successfully",
      data: {
        freeTrialMessageLimit:
          settings?.freeTrialMessageLimit ?? DEFAULT_FREE_TRIAL_LIMIT
      }
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const setChatSettings = async (req, res) => {
  try {
    const raw = req.body?.freeTrialMessageLimit;
    const freeTrialMessageLimit = Number.parseInt(raw, 10);

    if (!Number.isInteger(freeTrialMessageLimit) || freeTrialMessageLimit < 1) {
      return res.status(400).json({
        message: "freeTrialMessageLimit must be a positive integer"
      });
    }

    const settings = await ChatSettings.findOneAndUpdate(
      {},
      { $set: { freeTrialMessageLimit } },
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
      message: "Chat settings updated successfully",
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
