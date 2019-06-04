import sys
import shutil
import os
import subprocess

emcc = "/Users/jhelms/projects/emsdk/emscripten/1.38.27/emcc" 
arguments = "-std=c++11 -O2 -I../dots3 -s USE_SDL=1 -s WASM=0 -s --js-library library_engine.js -s ASSERTIONS=2 -o"

def create():
	if len(sys.argv) < 3:
		print("""
			Please specify a name for your game
		""")
		return

	name = sys.argv[2]
	print("Copying template...")
	shutil.copytree("examples/template", "examples/"+name)

def buildAll():
	directory = "examples"
	
	for filename in os.listdir(directory):
		if filename.startswith("."):
			continue
		mainPath = os.path.join(directory, filename, "main.cpp")
		outputPath = os.path.join(directory, filename, "main.js")
		command = "{} {}".format(mainPath, arguments)
		unwrappedArguments = [emcc, mainPath]
		unwrappedArguments.extend(arguments.split(' '))
		unwrappedArguments.append(outputPath)
		print("Building '{}'".format(mainPath))
		subprocess.run(unwrappedArguments)

def main():

	info = """
create [name]
buildAll
"""
	if len(sys.argv) < 2:
		print(info)
		return

	command = sys.argv[1]

	if command == "create":
		create()
	elif command == "buildAll":
		buildAll()
	else:
		print("Invalid command: ", command)
		print(info)


if __name__ == "__main__":
	main()