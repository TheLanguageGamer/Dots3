#include "Engine.h"

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("jhelms\n");
	Game game;
	game.entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}