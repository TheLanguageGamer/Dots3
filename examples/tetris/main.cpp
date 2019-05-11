#include "Engine.h"

struct Mode0 : Screen
{
	Mode0()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
	}
};

struct Mode1 : Screen
{
	Mode1()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xAA88FFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> mode0 = std::shared_ptr<Screen>(new Mode0());
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new Mode1());
	game.setScreen(mode1);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(mode0);
					break;
				}
				case 1:
				{
					game.setScreen(mode1);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}