import os
import subprocess

def run():
	needsConversion = set({})
	for path in os.listdir("Notes"):
		if (path.endswith("aiff")):
			needsConversion.add("Notes/" + path)

	for path in needsConversion:
		mp3Path = path[:-4] + "mp3"
		arguments = "-i " + path + " " + mp3Path
		print("running:", arguments)
		subprocess.run(["ffmpeg", "-i", path, mp3Path])