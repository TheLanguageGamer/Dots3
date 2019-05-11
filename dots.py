import sys
import shutil

def create():
	if len(sys.argv) < 3:
		print("""
			Please specify a name for your game
		""")
		return

	name = sys.argv[2]
	print("Copying template...")
	shutil.copytree("examples/template", "examples/"+name)

def main():

	info = """
create [name]
"""
	if len(sys.argv) < 2:
		print(info)
		return

	command = sys.argv[1]

	if command == "create":
		create()
	else:
		print("Invalid command: ", command)
		print(info)


if __name__ == "__main__":
	main()