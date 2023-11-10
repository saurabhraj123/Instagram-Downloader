import { Router } from "express";
import _ from "lodash";
import { getDownloadUrl } from "../utils/utils";

const router = Router();

router.get("/", async (req, res) => {
  const { url: postUrl } = req.query;
  const endPointUrl = `${postUrl}?__a=1&__d=dis`;

  const downloadUrl = await getDownloadUrl(endPointUrl);

  return res.send(downloadUrl);
});

export default router;
